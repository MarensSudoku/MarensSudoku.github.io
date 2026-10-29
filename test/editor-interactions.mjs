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
    await page.mouse.move(points[0].x,points[0].y);
    await page.waitForFunction(()=>{const pixels=capture();let warm=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]-pixels[i+2]>baseline[i]-baseline[i+2]+15)warm++;return warm>30;});
    assert.equal(await page.evaluate(()=>window.selected),null,'hover must not select an object');
    await page.screenshot({path:`output/${name}-editor-hover.png`});
    await page.mouse.move(950,630);
    assert.equal(await page.evaluate(()=>{const pixels=capture();let changed=0;for(let i=0;i<pixels.length;i++)if(Math.abs(pixels[i]-baseline[i])>1)changed++;return changed;}),0,'leaving the object must remove its glow');
    await page.mouse.click(points[0].x,points[0].y);assert.equal(await page.evaluate(()=>window.selected),'left');
    await page.mouse.click(points[1].x,points[1].y);assert.equal(await page.evaluate(()=>window.selected),'left','clicking another object must preserve the locked selection');
    await page.mouse.move(850,80);await page.mouse.down();await page.mouse.move(910,80,{steps:5});await page.mouse.up();
    const moved=await page.evaluate(()=>reef.getLayout());
    assert.ok(moved.objects.find(object=>object.id==='left').x>left.x,'dragging from empty sky must move the selected object');
    assert.deepEqual(moved.objects.find(object=>object.id==='right'),right,'global gestures must not alter other objects');
    await page.evaluate(()=>reef.select(null));await page.mouse.click(points[1].x,points[1].y);
    assert.equal(await page.evaluate(()=>window.selected),'right','releasing the selection must permit selecting another object');
    await page.evaluate(()=>reef.setEditMode(false));await page.mouse.click(points[0].x,points[0].y);
    assert.equal(await page.evaluate(()=>window.selected),null,'play mode must not select or highlight objects');
    assert.deepEqual(errors,[]);
    console.log(`${name}: all reef pieces editable, complete removal, hover glow, locked selection and dragging from empty space passed.`);
  } finally {await context.close();}
}
