import assert from 'node:assert/strict';

export async function checkMobileRing(browser,name,base){
  const context=await browser.newContext({viewport:{width:375,height:559},deviceScaleFactor:3,hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const touch=name==='chromium'?await context.newCDPSession(page):null;
    const swipe=async(x,y,dx,dy)=>{
      if(touch){
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
        for(let step=1;step<=6;step++){await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/6,y:y+dy*step/6,id:1}]});await page.waitForTimeout(16);}
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      } else {
        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:6});await page.mouse.up();
      }
    };
    await page.route('**/app.mjs',async route=>{
      const response=await route.fetch(),source=await response.text();
      const body=source.replace('aquarium=result;','aquarium=result;window.__ringTest=result;');
      assert.notEqual(body,source);await route.fulfill({response,body});
    });
    await page.goto(base);await page.locator('#welcome-start').tap();
    await page.waitForFunction(()=>window.__ringTest);await page.locator('#reef-view-toggle').tap();await page.locator('#reef-view-edit').tap();
    for(const [width,height] of [[375,559],[667,375],[240,320]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      for(const id of ['reef-crab','fish-0-0']){
        const point=await page.evaluate(id=>{
          __ringTest.select(id);const point=__ringTest.getEditorAnchor();__ringTest.select(null);return point;
        },id);
        // The raised claws put the ring anchor slightly above the shell.
        if(id==='reef-crab')point.y+=3;
        await page.touchscreen.tap(point.x,point.y);
        await page.waitForFunction(id=>document.getElementById('reef-editor').dataset.selected===id,id);
        assert.equal(await page.locator('.reef-editor-top').isHidden(),true);
        assert.equal(await page.locator('[data-reef-mode="move"]').getAttribute('aria-pressed'),'true','each reopened ring must start in Move mode');
        const controls=await page.locator('.reef-tool-ring').evaluate(ring=>[...ring.children].filter(node=>!node.hidden).map(node=>{
          const button=node.matches('button')?node:node.querySelector('button'),r=button.getBoundingClientRect();
          return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};
        }));
        assert.ok(controls.length>=13);assert.ok(controls.every(control=>control.inside),'all ring buttons must remain inside the visible screen');
        for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
          const a=controls[i],b=controls[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>(a.width+b.width)/2-1,'ring buttons must not stack under the green checkmark');
        }
        if(width===375)await page.screenshot({path:`output/${name}-mobile-ring-${id}.png`});
        if(width===375){
          const pose=()=>page.evaluate(id=>{const object=__ringTest.getLayout().objects.find(object=>object.id===id);return Object.fromEntries(['x','y','z','yaw','pitch','roll','scale'].map(key=>[key,object[key]]));},id);
          const motion=await page.locator('#reef-ring-motion').inputValue();
          assert.equal(await page.locator('#reef-ring-radius-open').isVisible(),motion!=='bounce');
          for(const field of ['hue','speed','radius'].filter(field=>field!=='radius'||motion!=='bounce')){
            await page.locator('#reef-ring-'+field+'-open').tap();
            const before=await pose(),input=page.locator('#reef-ring-'+field),value=await input.inputValue(),box=await input.boundingBox();
            await swipe(box.x+box.width*.2,box.y+box.height/2,box.width*.6,0);
            assert.notEqual(await input.inputValue(),value,'swiping the slider must change its value');
            assert.deepEqual(await pose(),before,'slider gestures must preserve every object transform');
            const free=await page.evaluate(()=>{for(const y of [innerHeight*.3,innerHeight*.5,innerHeight*.65])for(const x of [20,innerWidth-80])if(document.elementFromPoint(x,y)?.id==='reef-aquarium')return {x,y};throw new Error('No free reef area');});
            await page.mouse.move(free.x,free.y);await page.mouse.down();await page.mouse.move(free.x+30,free.y-20,{steps:6});await page.mouse.up();
            assert.deepEqual(await pose(),before,'canvas swipes must not transform objects while a slider is open');
            await page.locator('#reef-ring-'+field+'-open').tap();
            await page.waitForFunction(field=>document.getElementById('reef-ring-'+field+'-open').getAttribute('aria-expanded')==='false',field,{timeout:3000});
            assert.equal(await page.locator('#reef-ring-'+field+'-open').getAttribute('aria-expanded'),'false',`${field}: the slider must close after tapping its button`);
          }
        }
        await page.locator('[data-reef-mode="scale"]').tap();
        await page.locator('#reef-deselect').tap();assert.equal(await page.locator('.reef-editor-top').isVisible(),true);
      }
    }
    assert.deepEqual(errors,[]);console.log(`${name}: short mobile taps at 3× pixel density show separate ring buttons, hide the top bar and restore it with the green checkmark.`);
  }finally{await context.close();}
}
