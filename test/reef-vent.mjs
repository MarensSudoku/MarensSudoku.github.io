import assert from 'node:assert/strict';
import {build} from 'esbuild';

export async function checkReefVent(browser,name,base) {
  const fixture=await build({stdin:{contents:`
    import {createAquarium} from './web/game/aquarium.mjs';
    import {EngineStore} from '@babylonjs/core/Engines/engineStore.js';
    const aquarium=await createAquarium(document.querySelector('canvas'));
    window.ventTest={aquarium,scene:EngineStore.LastCreatedScene};
    if(aquarium){await aquarium.prepareObject('bubble-vent');ventTest.id=aquarium.addObject('bubble-vent',{x:0,y:.02,z:-4,scale:1});aquarium.setEditMode(true);}
  `,resolveDir:process.cwd(),sourcefile:'vent-test.mjs'},bundle:true,format:'esm',target:['safari15'],write:false,minify:true});
  const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'block',reducedMotion:'no-preference'});
  try {
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/game/vent-test.mjs',route=>route.fulfill({contentType:'text/javascript',body:fixture.outputFiles[0].text}));
    await context.route('**/vent-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/styles.css"><body class="game-page"><canvas id="reef-aquarium"></canvas><script type="module" src="/game/vent-test.mjs"></script>'}));
    await page.goto(new URL('vent-test.html',base).href);
    await page.waitForFunction(()=>window.ventTest);
    if(!await page.evaluate(()=>Boolean(ventTest.aquarium))){assert.equal(name,'webkit');return;}
    await page.waitForFunction(()=>ventTest.scene.particleSystems[0]?.getActiveCount()>25);
    const sizes=()=>page.evaluate(()=>ventTest.scene.particleSystems[0].particles.map(particle=>particle.scale.x+particle.scale.y));
    assert.ok((await sizes()).every(size=>Math.abs(size-1.8)<1e-6));
    await page.evaluate(()=>ventTest.aquarium.updateObject(ventTest.id,{scale:.5}));
    await page.waitForFunction(()=>ventTest.scene.particleSystems[0].particles.every(particle=>Math.abs(particle.scale.x+particle.scale.y-.9)<1e-6));
    await page.evaluate(()=>ventTest.aquarium.updateObject(ventTest.id,{scale:2}));
    await page.waitForFunction(()=>ventTest.scene.particleSystems[0].particles.every(particle=>Math.abs(particle.scale.x+particle.scale.y-3.6)<1e-6));
    assert.equal(await page.evaluate(()=>ventTest.scene.fluidRenderer.renderObjects[0].object.isReady()),true);
    await page.screenshot({path:`output/${name}-vent-scaled.png`});
    await page.evaluate(()=>ventTest.aquarium.updateOptions({reduced:true,dark:false}));
    assert.equal(await page.evaluate(()=>ventTest.scene.particleSystems.length),0,'reduced motion must stop the emitter and release its particles');
    await page.evaluate(()=>ventTest.aquarium.updateOptions({reduced:false,dark:false}));
    await page.waitForFunction(()=>ventTest.scene.particleSystems[0]?.getActiveCount()>10);
    await page.evaluate(()=>ventTest.aquarium.removeObject(ventTest.id));
    await page.waitForFunction(()=>ventTest.scene.particleSystems.length===0);
    assert.deepEqual(errors,[]);
    console.log(`${name}: native vent renders in the editor; existing and new bubbles follow scale; reduced motion and deletion release particles.`);
  } finally {await context.close();}
}
