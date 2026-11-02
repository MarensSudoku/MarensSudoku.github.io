import assert from 'node:assert/strict';
import {UNITS} from '../web/sudoku/engine.mjs';
import {createGame,emptyScores,validGame} from '../web/sudoku/model.mjs';

const puzzle='530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number);
const solution='534678912672195348198342567859761423426853791713924856961537284287419635345286179'.split('').map(Number);
function fixture(units) {
  const game=createGame({puzzle,solution,difficulty:'easy',seed:1,version:1});
  const missing=units.length>1?40:UNITS[units[0]].find(cell=>!puzzle[cell]);
  for(const cell of new Set(units.flatMap(unit=>UNITS[unit])))if(cell!==missing)game.values[cell]=solution[cell];
  assert.equal(validGame(game),true);
  return {missing,state:{schema:1,game,settings:{language:'de',theme:'light',reducedMotion:false,showConflicts:true,tracking:false,musicVolume:0,sfxEnabled:false},progress:null,scores:emptyScores()}};
}

export async function checkUnitBubbles(browser,name,base) {
  let rendered=false,density;
  for(const units of [[4],[13],[22],[4,13,22]]){
    const {missing,state}=fixture(units);
    const context=await browser.newContext({viewport:{width:1024,height:850},reducedMotion:'no-preference',serviceWorkers:'block'});
    try{
      await context.addInitScript(state=>{
        localStorage.setItem('marenssudoku:state:v1',JSON.stringify(state));
        window.__bubbleDraws=0;window.__bubblePixels=0;window.__bubblePoints=0;window.__bubbleWarmPixels=0;
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(...args){
          const result=get.apply(this,args);if(this.classList.contains('unit-bubbles'))window.__bubbleSupported=Boolean(result);return result;
        };
        const draw=WebGLRenderingContext.prototype.drawArrays;
        WebGLRenderingContext.prototype.drawArrays=function(...args){
          const result=draw.apply(this,args);
          if(this.canvas.classList.contains('unit-bubbles') && !this.getUniform(this.getParameter(this.CURRENT_PROGRAM),this.getUniformLocation(this.getParameter(this.CURRENT_PROGRAM),'u_map'))){
            window.__bubbleDraws++;window.__bubblePoints??=args[2];window.__bubbleInitialPoints??=args[2];window.__bubbleGL=this;
            if(window.__bubblePixels<30){
              const pixels=new Uint8Array(this.drawingBufferWidth*this.drawingBufferHeight*4);
              this.readPixels(0,0,this.drawingBufferWidth,this.drawingBufferHeight,this.RGBA,this.UNSIGNED_BYTE,pixels);
              let count=0,warm=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>8){count++;if(pixels[i]>pixels[i+1]+2||pixels[i+1]>pixels[i+2]+2)warm++;}
              window.__bubblePixels=Math.max(window.__bubblePixels,count);
              window.__bubbleWarmPixels=Math.max(window.__bubbleWarmPixels,warm);
            }
          }
          return result;
        };
      },state);
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);await page.locator('.board-shell.ready').waitFor();await page.locator('#welcome-start').click();
      assert.equal(await page.locator('.unit-bubbles').count(),0,'the GPU effect must be lazy');
      await page.locator(`[data-index="${missing}"]`).click();await page.keyboard.press(String(solution[missing]));
      if(await page.evaluate(()=>window.__bubbleSupported===false)){
        assert.equal(await page.locator(`[data-index="${missing}"] .cell-value`).textContent(),String(solution[missing]));
        assert.deepEqual(errors,[]);continue;
      }
      await page.waitForFunction(()=>window.__bubblePixels>30);
      rendered=true;
      const cells=new Set(units.flatMap(unit=>UNITS[unit])).size,points=await page.evaluate(()=>window.__bubbleInitialPoints);
      density??=points/cells;
      assert.ok(density>=30&&density<=48,'each completed cell must emit a bounded cloud of bubbles');
      assert.equal(points,cells*density,'intersections must not emit duplicate clouds');
      assert.equal(await page.evaluate(()=>window.__bubbleWarmPixels),0,'reflections must stay silver/cyan without soap-film rainbow colours');
      assert.equal(await page.locator('.unit-bubbles').getAttribute('aria-hidden'),'true');
      assert.equal(await page.locator('.unit-bubbles').evaluate(canvas=>getComputedStyle(canvas).pointerEvents),'none');
      assert.match(await page.locator('body').evaluate(body=>body.style.filter),/unit-bubble-refraction/,'the refraction must cover HTML as well as the aquarium');
      assert.match(await page.locator('#unit-bubble-refraction feImage').getAttribute('href'),/^data:image\/png/);
      await page.locator(`[data-index="${(missing+1)%81}"]`).click();
      assert.equal(await page.locator('.cell[aria-selected=true]').getAttribute('data-index'),String((missing+1)%81),'bubbles must not intercept Sudoku input');
      await page.screenshot({path:`output/${name}-unit-bubbles-${units.join('-')}.png`});
      await page.locator('.unit-bubbles').waitFor({state:'hidden',timeout:7000});
      assert.equal(await page.locator('body').evaluate(body=>body.style.filter),'','idle must restore the original page');
      const draws=await page.evaluate(()=>window.__bubbleDraws);await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>window.__bubbleDraws),draws,'the GPU effect must stop drawing when idle');
      if(units[0]===13){
        await page.setViewportSize({width:375,height:559});
        await page.locator('#undo').click();await page.locator(`[data-index="${missing}"]`).click();await page.keyboard.press(String(solution[missing]));
        await page.locator('.unit-bubbles').waitFor({state:'visible'});
        assert.equal(await page.locator('.unit-bubbles').evaluate(canvas=>Math.abs(canvas.getBoundingClientRect().width-innerWidth)<1),true);
        const recovery=await page.evaluate(()=>{window.__bubbleLoss=window.__bubbleGL.getExtension('WEBGL_lose_context');return Boolean(window.__bubbleLoss);});
        if(recovery){
          await page.evaluate(()=>window.__bubbleLoss.loseContext());
          await page.waitForFunction(()=>document.querySelector('.unit-bubbles').dataset.status==='lost');
          assert.equal(await page.locator('.unit-bubbles').isHidden(),true);
          await page.evaluate(()=>window.__bubbleLoss.restoreContext());
          await page.waitForFunction(()=>document.querySelector('.unit-bubbles').dataset.status==='ready');
          await page.locator('#undo').click();await page.locator(`[data-index="${missing}"]`).click();await page.keyboard.press(String(solution[missing]));
          await page.locator('.unit-bubbles').waitFor({state:'visible'});
        }
        await page.locator('#settings-open').click();await page.locator('#reduced-motion').check();
        assert.equal(await page.locator('.unit-bubbles').isHidden(),true,'reduced motion must stop an active effect');
      }
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  for(const mode of ['reduced','unsupported']){
    const {missing,state}=fixture([4]);
    const context=await browser.newContext({viewport:{width:375,height:559},hasTouch:true,reducedMotion:mode==='reduced'?'reduce':'no-preference',serviceWorkers:'block'});
    try{
      await context.addInitScript(({state,mode})=>{
        localStorage.setItem('marenssudoku:state:v1',JSON.stringify(state));
        if(mode==='unsupported'){
          const get=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(...args){return this.classList.contains('unit-bubbles')?null:get.apply(this,args);};
        }
      },{state,mode});
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);await page.locator('.board-shell.ready').waitFor();await page.locator('#welcome-start').click();
      await page.locator(`[data-index="${missing}"]`).tap();await page.locator(`[data-number="${solution[missing]}"]`).tap();
      assert.equal(await page.locator('.unit-bubbles').count(),0,`${mode}: effects must not block gameplay`);
      assert.equal(await page.locator(`[data-index="${missing}"] .cell-value`).textContent(),String(solution[missing]));
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  console.log(`${name}: ${rendered?'row/column/box shaders render real pixels; overlap deduplication, touch, idle cleanup and supported context recovery passed':'WebGL unavailable; graceful fallback passed'}; reduced motion and unsupported WebGL passed.`);
}
