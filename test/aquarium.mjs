import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { checkReefEditor } from './reef-editor.mjs';
import { REEF_STORAGE_KEY } from '../web/reef-layout.mjs';
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4175/';
await mkdir('output',{recursive:true});
for (const [name,type] of [['chromium',chromium],['webkit',webkit]]) {
  console.log(`${name}: starting animated 3D aquarium checks.`);
  const browser=await type.launch({headless:true,args:name==='chromium' ? ['--enable-unsafe-swiftshader'] : []});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addInitScript(()=> {
      window.__aquariumDraws=0; window.__resizeDraws=[]; window.__resizeImages=[];
      window.__readAquarium=()=> {
        const canvas=document.querySelector('#reef-aquarium'), gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
        const pixels=new Uint8Array(canvas.width*canvas.height*4), colours=new Set();
        gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let opaque=0;
        for(let y=1;y<10;y++)for(let x=1;x<10;x++) {
          const i=(Math.floor(y*canvas.height/10)*canvas.width+Math.floor(x*canvas.width/10))*4;
          if(pixels[i+3]===255)opaque++;
          colours.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        }
        return {opaque,colours:colours.size};
      };
      for(const Context of [window.WebGLRenderingContext,window.WebGL2RenderingContext]) {
        if(!Context)continue;
        for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
          const original=Context.prototype[key]; if(!original)continue;
          Context.prototype[key]=function(...args){window.__aquariumDraws++;return original.apply(this,args);};
        }
      }
      addEventListener('resize',()=>{window.__resizeStart=window.__aquariumDraws;},true);
    });
    const page=await context.newPage(), errors=[], external=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(new URL(base).origin))external.push(request.url());});
    await page.goto(base);
    const watchResize=()=>page.evaluate(()=>addEventListener('resize',()=> {
      window.__resizeDraws.push(window.__aquariumDraws-window.__resizeStart);
      window.__resizeImages.push(window.__readAquarium());
    }));
    const freshWebKitPhoto=async()=> {
      // Windows WebKit screenshots lose resized WebGL surfaces: playwright#42885.
      if(name==='webkit'&&process.platform==='win32') {
        await page.reload(); await page.waitForFunction(()=>document.querySelector('#reef-aquarium')?.dataset.status==='ready');
        await watchResize();
      }
    };
    await page.waitForFunction(()=>['ready','unavailable'].includes(document.querySelector('#reef-aquarium')?.dataset.status));
    const status=await page.locator('#reef-aquarium').getAttribute('data-status');
    console.log(`${name}: aquarium ${status}; checking resize, motion and offline reload.`);
    if(status==='ready') {
      assert.ok(await page.evaluate(()=>window.__aquariumDraws)>0);
      assert.equal(await page.locator('#reef-background-video').evaluate(video=>video.hidden&&video.paused),true);
      await watchResize();
      for(const [width,height] of [[375,559],[667,375],[320,480],[1024,600],[1440,900],[390,664]]) {
        const before=await page.evaluate(()=>window.__resizeDraws.length);
        await page.setViewportSize({width,height});
        await page.waitForFunction(count=>window.__resizeDraws.length>count,before);
        assert.ok(await page.evaluate(()=>window.__resizeDraws.at(-1))>0,'resize must redraw synchronously');
        assert.equal(await page.locator('body').evaluate(body=>getComputedStyle(body).backgroundImage),'none');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),true);
        const image=await page.evaluate(()=>window.__resizeImages.at(-1));
        assert.equal(image.opaque,81,`${name}: resize must retain the actual WebGL frame`);
        assert.ok(image.colours>8,`${name}: the frame must contain reef geometry`);
      }
      await freshWebKitPhoto(); await page.screenshot({path:`output/${name}-aquarium-mobile.png`});
      await page.locator('#settings-open').click(); await page.locator('#reduced-motion').check();
      await page.locator('#settings-dialog .dialog-close').click(); await page.waitForTimeout(150);
      const paused=await page.evaluate(()=>window.__aquariumDraws); await page.waitForTimeout(250);
      assert.equal(await page.evaluate(()=>window.__aquariumDraws),paused,'reduced motion must stop continuous rendering');
      await page.setViewportSize({width:1440,height:900});
      await page.waitForTimeout(80);
      const still=await page.evaluate(()=>window.__resizeImages.at(-1)); assert.equal(still.opaque,81); assert.ok(still.colours>8);
      await freshWebKitPhoto(); await page.screenshot({path:`output/${name}-aquarium-desktop.png`});
      const personalReef=await checkReefEditor(page,name);
      const beforeResume=await page.evaluate(()=>window.__aquariumDraws);
      await page.locator('#settings-open').click(); await page.locator('#reduced-motion').uncheck();
      await page.locator('#settings-dialog .dialog-close').click();
      await page.waitForFunction(count=>window.__aquariumDraws>count,beforeResume);
      await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
      await context.setOffline(true); await page.reload();
      await page.waitForFunction(()=>document.querySelector('#reef-aquarium')?.dataset.status==='ready');
      await page.locator('.board-shell.ready').waitFor();
      assert.equal(await page.locator('[role=gridcell]').count(),81);
      assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),personalReef);
      await context.setOffline(false);
      console.log(`${name}: real 3D, local models, resize without a blank frame, six viewports and reduced motion passed.`);
      console.log(`${name}: all aquarium models and water lighting reload offline.`);
    } else {
      assert.equal(name,'webkit','Chromium must render the real aquarium');
      await page.locator('.board-shell.ready').waitFor();
      assert.equal(await page.locator('[role=gridcell]').count(),81);
      console.log('webkit: no WebGL on this host; fallback and accessible grid passed.');
    }
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
    await context.close();
    if(name==='chromium') {
      const fallback=await browser.newContext({serviceWorkers:'block'});
      await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};});
      const tab=await fallback.newPage(); await tab.goto(base);
      await tab.waitForFunction(()=>document.querySelector('#reef-aquarium')?.dataset.status==='unavailable');
      await tab.locator('.board-shell.ready').waitFor();
      assert.equal(await tab.locator('[role=gridcell]').count(),81);
      assert.equal(await tab.locator('#reef-background-video').evaluate(video=>!video.hidden&&video.muted),true);
      await fallback.close(); console.log('chromium: unavailable 3D preserves the playable grid and muted fallback.');
    }
  } finally { await browser.close(); }
}
