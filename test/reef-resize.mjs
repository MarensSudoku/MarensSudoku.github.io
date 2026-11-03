import assert from 'node:assert/strict';

export async function checkReefResize(browser,name,base) {
  for(const reducedMotion of ['reduce','no-preference']){
    const context=await browser.newContext({viewport:{width:375,height:667},deviceScaleFactor:2,hasTouch:true,isMobile:true,reducedMotion,serviceWorkers:'block'});
    try{
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);await page.locator('.board-shell.ready').waitFor();await page.locator('#welcome-start').click();
      await page.waitForFunction(()=>['ready','unavailable'].includes(document.getElementById('reef-aquarium').dataset.status));
      if(await page.locator('#reef-aquarium').getAttribute('data-status')==='unavailable'){
        assert.equal(name,'webkit','Chromium must render the reef during rotation checks');
        console.log(`${name}: WebGL unavailable; rotation checks skipped.`);return;
      }
      await page.locator('#reef-view-toggle').click();
      for(const energySaver of [false,true]){
        if(energySaver){
          await page.locator('#settings-open').click();await page.locator('#energy-saver').check();
          await page.locator('#settings-dialog .dialog-close').click();
        }
        for(const [width,height] of [[667,375],[375,667],[667,320],[375,559]]){
          // Safari can finish the canvas layout after the window resize event.
          await page.locator('#reef-aquarium').evaluate(canvas=>{canvas.style.width=canvas.clientWidth+'px';canvas.style.height=canvas.clientHeight+'px';});
          await page.setViewportSize({width,height});
          await page.locator('#reef-aquarium').evaluate(canvas=>{canvas.style.removeProperty('width');canvas.style.removeProperty('height');});
          await page.waitForFunction(energySaver=>{
            const canvas=document.getElementById('reef-aquarium'),scale=energySaver?Math.max(1,1/devicePixelRatio*1.5):1/devicePixelRatio;
            return canvas.width===Math.floor(canvas.clientWidth/scale)&&canvas.height===Math.floor(canvas.clientHeight/scale);
          },energySaver,{timeout:3000});
          const size=await page.locator('#reef-aquarium').evaluate(canvas=>{
            const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
            return {css:canvas.clientWidth/canvas.clientHeight,render:gl.drawingBufferWidth/gl.drawingBufferHeight,viewport:Array.from(gl.getParameter(gl.VIEWPORT))};
          });
          assert.ok(Math.abs(size.css-size.render)<.01,'the rendered reef must keep the displayed aspect ratio after a delayed orientation layout');
          assert.ok(Math.abs(size.viewport[2]/size.viewport[3]-size.css)<.01,'the WebGL viewport must resize too');
          if(width===667&&height===375&&!energySaver&&reducedMotion==='reduce')await page.screenshot({path:`output/${name}-iphone8-reef-landscape.png`});
        }
      }
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  console.log(`${name}: iPhone 8 portrait/landscape and delayed canvas layouts retain reef proportions, with animation, reduced motion and battery saver.`);
}
