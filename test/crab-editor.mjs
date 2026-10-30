import assert from 'node:assert/strict';
import {REEF_STORAGE_KEY} from '../web/reef-layout.mjs';

export async function checkCrabEditor(browser,name,base){
  const context=await browser.newContext({viewport:{width:375,height:559},hasTouch:true,reducedMotion:'reduce',locale:'de-DE',serviceWorkers:'block'});
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('#welcome-start').tap();
    await page.waitForFunction(()=>['ready','unavailable','awaiting-models'].includes(document.getElementById('reef-aquarium').dataset.status));
    assert.equal(await page.locator('#reef-aquarium').getAttribute('data-status'),'ready',JSON.stringify(errors));
    const enter=async()=>{
      if(await page.locator('#reef-view-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#reef-view-toggle').tap();
      await page.locator('#reef-view-edit').tap();await page.locator('#reef-object-list').tap();
      await page.locator('[data-reef-id="reef-crab"]').check();await page.locator('#reef-edit-selected').tap();
    };
    await enter();const expected={};
    assert.equal(await page.locator('#reef-ring-motion-open').getAttribute('aria-label'),'Bewegungsverhalten');
    assert.deepEqual(await page.locator('#reef-ring-motion option').evaluateAll(options=>options.map(option=>option.value)),['still','circle','patrol','eight','rest']);
    await page.locator('#reef-ring-motion-open').tap();await page.locator('#reef-ring-motion').selectOption('eight');await page.keyboard.press('Escape');
    await page.locator('#reef-undo').tap();assert.equal(await page.locator('#reef-ring-motion').inputValue(),'still','undo must restore the original natural walk');
    await page.locator('#reef-ring-motion-open').tap();await page.locator('#reef-ring-motion').selectOption('rest');await page.keyboard.press('Escape');
    for(const [field,label,step] of [['speed','Lauftempo',.1],['radius','Bewegungsradius',.25]]){
      const button=page.locator('#reef-ring-'+field+'-open'),input=page.locator('#reef-ring-'+field);
      assert.equal(await button.isVisible(),true);assert.equal(await button.getAttribute('aria-label'),label);
      const original=Number(await input.inputValue());
      await button.tap();await input.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
      await page.locator('#reef-undo').tap();assert.equal(Number(await input.inputValue()),original);
      await button.tap();await input.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
      expected[field]=original+step;assert.ok(Math.abs(Number(await input.inputValue())-expected[field])<1e-8);
    }
    await page.locator('#reef-ring-motion-open').tap();
    await page.screenshot({path:`output/${name}-crab-behaviour.png`});
    await page.keyboard.press('Escape');await page.locator('#reef-deselect').tap();await page.locator('#reef-finish').tap();
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).objects.find(object=>object.id==='reef-crab'),REEF_STORAGE_KEY);
    for(const field of ['speed','radius'])assert.ok(Math.abs(saved[field]-expected[field])<1e-8);
    assert.equal(saved.motion,'rest');
    await page.reload();await page.locator('#welcome-start').tap();await page.waitForFunction(()=>!document.getElementById('reef-view-edit').disabled);
    await enter();
    for(const field of ['speed','radius'])assert.ok(Math.abs(Number(await page.locator('#reef-ring-'+field).inputValue())-expected[field])<1e-8);
    assert.equal(await page.locator('#reef-ring-motion').inputValue(),'rest');
    assert.deepEqual(errors,[]);console.log(`${name}: crab walking choices, resting, ring speed/radius, undo, saving and reload passed at ${new URL(base).host}.`);
  }finally{await context.close();}
}
