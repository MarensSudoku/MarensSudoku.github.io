import assert from 'node:assert/strict';
import { reefObject } from '../web/reef-layout.mjs';

export async function checkShadows(browser,name,base) {
  const context=await browser.newContext({viewport:{width:960,height:640},serviceWorkers:'block'});
  try {
    const page=await context.newPage();
    await page.route('**/shadow-check',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas><script type="module">import {createAquarium} from "./game/aquarium.mjs";window.reef=await createAquarium(document.querySelector("canvas"));reef.updateOptions({dark:false,reduced:true});window.ready=true;</script>'}));
    await page.goto(new URL('shadow-check',base).href);
    await page.waitForFunction(()=>window.ready);
    const fish=reefObject('butterflyfish','shadow-fish',{y:3,scale:2.5,motion:'still'}), samples=[];
    for(const [label,objects] of [['empty',[]],['fish',[fish]],['overlap',[fish,{...fish,id:'second-fish'}]],['moved',[{...fish,x:3}]],['removed',[]]]) {
      assert.equal(await page.evaluate(objects=>reef.setLayout({schema:1,objects}),objects),true);
      await page.waitForTimeout(200);
      samples.push(await page.evaluate(label=>{
        // Read immediately after drawing: WebGL may discard the frame after returning to the browser.
        dispatchEvent(new Event('resize'));
        const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        if(label==='empty'){window.baseline=pixels;return null;}
        let dark=0,sumX=0,overlapDifference=0;
        // The lower sand area excludes the elevated fish itself.
        for(let y=0;y<canvas.height*.35;y++)for(let x=Math.floor(canvas.width*.2);x<canvas.width*.8;x++){
          const i=(y*canvas.width+x)*4,difference=(baseline[i]+baseline[i+1]+baseline[i+2]-pixels[i]-pixels[i+1]-pixels[i+2])/3;
          if(difference>10){dark++;sumX+=x;}
          if(label==='overlap'&&[0,1,2].some(channel=>Math.abs(pixels[i+channel]-window.singleShadow[i+channel])>1))overlapDifference++;
        }
        if(label==='fish')window.singleShadow=pixels;
        return {dark,x:sumX/Math.max(1,dark),overlapDifference};
      },label));
      if(label==='fish')await page.screenshot({path:`output/${name}-fish-shadow.png`});
    }
    assert.ok(samples[1].dark>10,`${name}: fish must cast a visible shadow onto the sand`);
    assert.equal(samples[2].overlapDifference,0,`${name}: overlapping shadows must retain the same opacity`);
    assert.ok(samples[3].dark>10&&samples[3].x>samples[1].x+10,`${name}: moving a fish must move its shadow`);
    assert.equal(samples[4].dark,0,`${name}: removing a fish must remove its shadow`);
    console.log(`${name}: projected fish shadows follow movement, keep their opacity when overlapping and disappear on removal.`);
  } finally {await context.close();}
}
