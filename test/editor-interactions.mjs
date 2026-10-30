import assert from 'node:assert/strict';
import {reefObject} from '../web/reef-layout.mjs';

export async function checkEditorInteractions(browser,name,base) {
  const context=await browser.newContext({viewport:{width:960,height:640},serviceWorkers:'block'});
  try {
    // Exercise the full default reef, including distant pieces, on software-only test hosts.
    await context.addInitScript(()=>{
      window.draws=0;
      for(const Context of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
        if(!Context)continue;
        const get=Context.prototype.getParameter;
        Context.prototype.getParameter=function(parameter){return parameter===0x9246?'Test hardware renderer':get.call(this,parameter);};
        for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
          const draw=Context.prototype[key];if(draw)Context.prototype[key]=function(...args){window.draws++;return draw.apply(this,args);};
        }
      }
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/editor-check',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0}canvas{width:100vw;height:100vh;display:block;touch-action:pinch-zoom}</style><canvas></canvas><script type="module">import {createAquarium} from "./game/aquarium.mjs";window.reef=await createAquarium(document.querySelector("canvas"));reef.updateOptions({dark:false,reduced:true});reef.onSelection(object=>window.selected=object?.id||null);window.ready=true;</script>'}));
    await page.goto(new URL('editor-check',base).href);await page.waitForFunction(()=>window.ready);
    assert.equal(await page.evaluate(()=>reef.defaultLayout.objects.filter(object=>object.id.startsWith('pillar-')).length),50,'all distant reef pieces must be editable records');
    assert.equal(await page.evaluate(()=>reef.setLayout({schema:1,objects:[]})),true);
    const emptyDraws=await page.evaluate(()=>{const before=draws;dispatchEvent(new Event('resize'));return draws-before;});
    assert.ok(emptyDraws<40,`${name}: deleting all objects must leave only water and sand, not hidden reef geometry (${emptyDraws} draws)`);
    const left=reefObject('blue-tang','left',{x:-1.5,y:3,z:-3,scale:1.8,motion:'still'}),right={...left,id:'right',x:1.5};
    const points=await page.evaluate(objects=>{
      reef.setLayout({schema:1,objects});
      const points=objects.map(object=>{reef.select(object.id);return reef.getEditorAnchor();});
      reef.select(null);reef.setEditMode(true);
      window.capture=()=>{
        dispatchEvent(new Event('resize'));
        const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
      };
      window.baseline=capture();return points;
    },[left,right]);
    const recolor=await page.evaluate(points=>{
      reef.updateObject('left',{hue:25});const pixels=capture(),canvas=document.querySelector('canvas'),counts=[];
      for(const point of points){let changed=0;for(let y=Math.max(0,Math.floor(point.y-60));y<Math.min(canvas.height,point.y+60);y++)for(let x=Math.max(0,Math.floor(point.x-60));x<Math.min(canvas.width,point.x+60);x++){const i=((canvas.height-1-y)*canvas.width+x)*4;if([0,1,2].some(c=>Math.abs(pixels[i+c]-baseline[i+c])>8))changed++;}counts.push(changed);}
      reef.updateObject('left',{hue:0});window.baseline=capture();return counts;
    },points);
    assert.ok(recolor[0]>30,`${name}: recolouring must visibly change the selected model`);
    assert.equal(recolor[1],0,`${name}: recolouring must not change another copy sharing its material`);
    const tintCounts=()=>page.evaluate(points=>{
      const pixels=capture(),canvas=document.querySelector('canvas');
      return points.map(point=>{
        let body=0,tinted=0,changed=0;
        for(let y=Math.floor(point.y-35);y<point.y+35;y++)for(let x=Math.floor(point.x-50);x<point.x+50;x++){
          const i=((canvas.height-1-y)*canvas.width+x)*4;
          if([0,1,2].some(c=>Math.abs(pixels[i+c]-baseline[i+c])>8))changed++;
          if(baseline[i]<100&&baseline[i+1]<150&&baseline[i+2]>baseline[i]+40&&baseline[i+2]>baseline[i+1]+20){body++;if(pixels[i]>pixels[i+2]+60)tinted++;}
        }
        return {body,tinted,changed};
      });
    },points);
    await page.mouse.move(points[0].x,points[0].y);
    await page.waitForFunction(()=>{const pixels=capture();let warm=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]-pixels[i+2]>baseline[i]-baseline[i+2]+15)warm++;return warm>30;});
    assert.equal(await page.evaluate(()=>window.selected),null,'hover must not select an object');
    const tint=await tintCounts();
    assert.ok(tint[0].body>100&&tint[0].tinted/tint[0].body>.8,`${name}: the fill must cover the object interior, not only its glowing outline: ${JSON.stringify(tint)}`);
    assert.equal(tint[1].changed,0,'highlighting must not tint another object sharing the material');
    assert.deepEqual(await page.evaluate(()=>reef.getLayout()),{schema:1,objects:[left,right]},'highlighting must not modify saved object colours or transforms');
    await page.screenshot({path:`output/${name}-editor-hover.png`});
    await page.mouse.move(950,630);
    assert.equal(await page.evaluate(()=>{const pixels=capture();let changed=0;for(let i=0;i<pixels.length;i++)if(Math.abs(pixels[i]-baseline[i])>1)changed++;return changed;}),0,'leaving the object must restore its original appearance');
    await page.mouse.click(points[0].x,points[0].y);assert.equal(await page.evaluate(()=>window.selected),'left');
    await page.mouse.click(points[1].x,points[1].y);assert.equal(await page.evaluate(()=>window.selected),'left','clicking another object must preserve the locked selection');
    assert.ok((await tintCounts())[0].tinted>100,'the locked selection must retain its fill after the pointer leaves');
    await page.evaluate(()=>reef.setColorPreview(true));
    assert.equal((await tintCounts())[0].tinted,0,'the colour palette must preview the actual object colour');
    await page.evaluate(()=>reef.setColorPreview(false));
    assert.ok((await tintCounts())[0].tinted>100,'closing the colour palette must restore the selection fill');
    await page.mouse.move(850,80);await page.mouse.down();await page.mouse.move(910,80,{steps:5});await page.mouse.up();
    const moved=await page.evaluate(()=>reef.getLayout());
    assert.ok(moved.objects.find(object=>object.id==='left').x>left.x,'dragging from empty sky must move the selected object');
    assert.deepEqual(moved.objects.find(object=>object.id==='right'),right,'global gestures must not alter other objects');
    await page.evaluate(()=>reef.select(null));await page.mouse.click(points[1].x,points[1].y);
    assert.equal(await page.evaluate(()=>window.selected),'right','releasing the selection must permit selecting another object');
    if(name==='chromium'){
      await page.evaluate(objects=>reef.setLayout({schema:1,objects}),[left,right]);
      const touch=await context.newCDPSession(page);
      const send=(type,point)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{...point,id:1}]:[]});
      const unchanged=async()=>assert.deepEqual(await page.evaluate(()=>reef.getLayout()),{schema:1,objects:[left,right]},'touch selection must preserve every object transform');
      try{
        await send('touchStart',points[0]);
        assert.equal(await page.evaluate(()=>window.selected),null,'touch down must only highlight, not enter object edit mode');
        await unchanged();
        await send('touchMove',points[1]);
        assert.equal(await page.evaluate(()=>window.selected),null,'dragging across objects must keep selection pending');
        const targetTint=await tintCounts();
        assert.equal(targetTint[0].changed,0,'sliding away must restore the previous target');
        assert.ok(targetTint[1].tinted>100,'the whole-object fill must follow the touch target');
        await unchanged();
        await send('touchEnd');
        assert.equal(await page.evaluate(()=>window.selected),'right','releasing must edit the object under the final touch position');
        await unchanged();
        await page.evaluate(()=>reef.select(null));
        await send('touchStart',points[0]);await send('touchCancel');
        assert.equal(await page.evaluate(()=>window.selected),null,'a cancelled touch must not select an object');
        await unchanged();
        await send('touchStart',points[0]);await send('touchMove',{x:850,y:80});await send('touchEnd');
        assert.equal(await page.evaluate(()=>window.selected),null,'releasing over empty water must leave no object selected');
        await unchanged();
        await send('touchStart',{x:850,y:80});await send('touchMove',points[0]);await send('touchEnd');
        assert.equal(await page.evaluate(()=>window.selected),'left','a selection gesture may start over empty water');
        await unchanged();
        await send('touchStart',{x:850,y:80});await send('touchMove',{x:910,y:80});await send('touchEnd');
        assert.ok(await page.evaluate(x=>reef.getLayout().objects.find(object=>object.id==='left').x>x,left.x),'the next touch gesture must transform the locked selection');
      }finally{await touch.detach();}
    }
    await page.evaluate(()=>reef.setEditMode(false));await page.mouse.click(points[0].x,points[0].y);
    assert.equal(await page.evaluate(()=>window.selected),null,'play mode must not select or highlight objects');
    assert.deepEqual(errors,[]);
    console.log(`${name}: all reef pieces editable, complete removal, hover glow, locked selection and dragging from empty space passed${name==='chromium'?', including touch selection on release and cancellation':''}.`);
  } finally {await context.close();}
}
