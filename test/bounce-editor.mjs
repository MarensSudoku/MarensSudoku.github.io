import assert from 'node:assert/strict';
import {REEF_STORAGE_KEY} from '../web/reef-layout.mjs';

export async function checkBounceEditor(browser,name,base) {
  const context=await browser.newContext({viewport:{width:375,height:559},hasTouch:true,reducedMotion:'reduce',locale:'de-DE',serviceWorkers:'block'});
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('#welcome-start').tap();
    await page.waitForFunction(()=>document.getElementById('reef-aquarium').dataset.status==='ready');
    await page.locator('#reef-view-toggle').tap();await page.locator('#reef-view-edit').tap();
    for(const id of ['reef-crab','fish-0-0']){
      await page.locator('#reef-object-list').tap();await page.locator(`[data-reef-id="${id}"]`).check();await page.locator('#reef-edit-selected').tap();
      await page.locator('#reef-ring-motion-open').tap();
      assert.equal(await page.locator('#reef-ring-motion option[value="bounce"]').textContent(),'An Hindernissen umkehren');
      if(await page.locator('#reef-ring-motion').inputValue()==='bounce')await page.locator('#reef-ring-motion').selectOption('still');
      const original=await page.locator('#reef-ring-motion').inputValue();
      await page.locator('#reef-ring-motion').selectOption('bounce');await page.keyboard.press('Escape');
      assert.equal(await page.locator('#reef-ring-radius-open').isVisible(),false,'This mode runs between actual obstacles, without a radius limit');
      assert.match(await page.locator('#reef-ring-motion').getAttribute('title'),/Bildschirmrändern/);
      await page.locator('#reef-undo').tap();assert.equal(await page.locator('#reef-ring-motion').inputValue(),original);
      await page.locator('#reef-ring-motion-open').tap();await page.locator('#reef-ring-motion').selectOption('bounce');await page.keyboard.press('Escape');
      await page.screenshot({path:`output/${name}-${id}-bounce-mode.png`});await page.locator('#reef-deselect').tap();
    }
    await page.locator('#reef-finish').tap();
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY);
    for(const id of ['reef-crab','fish-0-0'])assert.equal(saved.objects.find(object=>object.id===id).motion,'bounce');
    await page.reload();await page.locator('#welcome-start').tap();
    await page.waitForFunction(()=>document.getElementById('reef-aquarium').dataset.status==='ready');
    assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),saved);
    assert.deepEqual(errors,[]);console.log(name+': German obstacle-turning mode for fish and crab, radius controls, undo, saving and reload passed.');
  }finally{await context.close();}
}
