import assert from 'node:assert/strict';

export async function checkMobileRing(browser,name,base){
  const context=await browser.newContext({viewport:{width:375,height:559},deviceScaleFactor:3,hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
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
        await page.touchscreen.tap(point.x,point.y);
        await page.waitForFunction(id=>document.getElementById('reef-editor').dataset.selected===id,id);
        assert.equal(await page.locator('.reef-editor-top').isHidden(),true);
        const controls=await page.locator('.reef-tool-ring').evaluate(ring=>[...ring.children].filter(node=>!node.hidden).map(node=>{
          const button=node.matches('button')?node:node.querySelector('button'),r=button.getBoundingClientRect();
          return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};
        }));
        assert.ok(controls.length>=13);assert.ok(controls.every(control=>control.inside),'all ring buttons must remain inside the visible screen');
        for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
          const a=controls[i],b=controls[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>(a.width+b.width)/2-1,'ring buttons must not stack under the green checkmark');
        }
        if(width===375)await page.screenshot({path:`output/${name}-mobile-ring-${id}.png`});
        await page.locator('#reef-deselect').tap();assert.equal(await page.locator('.reef-editor-top').isVisible(),true);
      }
    }
    assert.deepEqual(errors,[]);console.log(`${name}: short mobile taps at 3× pixel density show separate ring buttons, hide the top bar and restore it with the green checkmark.`);
  }finally{await context.close();}
}
