import assert from 'node:assert/strict';
import {REEF_ADDITIONS} from '../web/reef-additions.mjs';
import {REEF_STORAGE_KEY,REEF_TYPES} from '../web/reef-layout.mjs';
import {ACHIEVEMENTS} from '../web/sudoku/model.mjs';

export async function checkReefAdditions(browser,name,base){
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'de-DE',reducedMotion:'reduce'});
  try{
    await context.addInitScript(()=>{
      const progress=sessionStorage.getItem('reef-test-progress');if(!progress)return;
      const key='marenssudoku:state:v1',saved=JSON.parse(localStorage.getItem(key));
      saved.progress=JSON.parse(progress);saved.settings.tracking=true;localStorage.setItem(key,JSON.stringify(saved));sessionStorage.removeItem('reef-test-progress');
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const start=async()=>{await page.locator('#welcome-start').click();await page.waitForFunction(()=>document.getElementById('reef-aquarium').dataset.status==='ready');};
    const enter=async()=>{if(await page.locator('#reef-view-toggle').getAttribute('aria-pressed')!=='true')await page.locator('#reef-view-toggle').click();await page.locator('#reef-view-edit').click();};
    const picker=()=>page.locator('#reef-add-type').click();
    const card=id=>page.locator(`[data-reef-type="${id}"]`);
    const setProgress=async progress=>{
      await page.evaluate(progress=>sessionStorage.setItem('reef-test-progress',JSON.stringify(progress)),progress);
      await page.reload();await start();await enter();await picker();
    };
    await page.goto(base);await start();await enter();await picker();
    assert.equal(await card('manta-ray').isDisabled(),true);assert.equal(await card('seahorse').isDisabled(),true);
    assert.equal(await page.locator('[data-reef-type]').count(),REEF_TYPES.length);
    await page.waitForFunction(()=>[...document.querySelectorAll('#reef-picker img')].every(img=>img.complete&&img.naturalWidth===192));
    await page.screenshot({path:`output/${name}-reef-unlocks.png`});
    await page.locator('#reef-picker-dialog .dialog-close').click();await page.locator('#reef-cancel').click();
    await setProgress({total:1,easy:1,medium:0,hard:0,direct:1,unlocked:['first','direct']});
    assert.equal(await card('seahorse').isEnabled(),true);assert.equal(await card('manta-ray').isDisabled(),true);
    await page.locator('#reef-picker-dialog .dialog-close').click();await page.locator('#reef-cancel').click();
    await setProgress({total:10,easy:10,medium:0,hard:0,direct:10,unlocked:['first','flow','direct']});
    assert.equal(await card('manta-ray').isEnabled(),true);assert.equal(await card('seahorse').isEnabled(),true);
    await page.locator('#reef-picker-dialog .dialog-close').click();await page.locator('#reef-cancel').click();
    await setProgress({total:100,easy:85,medium:10,hard:5,direct:100,unlocked:ACHIEVEMENTS.map(item=>item.id)});
    await page.locator('#reef-picker-dialog .dialog-close').click();
    const count=Number(await page.locator('#reef-count').textContent());
    for(const spec of REEF_ADDITIONS){
      await picker();assert.equal(await card(spec.id).isEnabled(),true);await card(spec.id).click();
      await page.waitForFunction(()=>Boolean(document.getElementById('reef-editor').dataset.selected));
      assert.equal(await page.locator('#reef-object-tools').isVisible(),true);
      if(spec.kind!=='prop')assert.equal(await page.locator('#reef-ring-speed-open').isVisible(),true);
      await page.locator('#reef-deselect').click();
    }
    assert.equal(Number(await page.locator('#reef-count').textContent()),count+REEF_ADDITIONS.length);
    await page.locator('#reef-finish').click();
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY);
    for(const spec of REEF_ADDITIONS)assert.ok(saved.objects.some(object=>object.type===spec.id));
    await page.waitForFunction(async()=>Boolean(navigator.serviceWorker.controller)&&(await caches.keys()).some(key=>key.startsWith('marenssudoku:')&&!key.endsWith('selection')));
    await context.setOffline(true);await page.reload();await start();
    assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),saved);
    await enter();await page.locator('#reef-object-list').click();
    assert.equal(await page.locator('[data-reef-id]').count(),saved.objects.length);
    await page.locator('#reef-picker-dialog .dialog-close').click();await page.locator('#reef-cancel').click();
    await page.locator('#achievements-nav').click();
    const rewards=await page.locator('.achievement-rewards').allTextContents();
    assert.match(rewards[0],/Seepferdchen/);assert.match(rewards[1],/Mantarochen/);
    await page.screenshot({path:`output/${name}-reef-rewards.png`});
    assert.deepEqual(errors,[]);
    console.log(`${name}: first/ten-round unlocks, all ${REEF_ADDITIONS.length} added models, ring controls, saving and offline reload passed.`);
  }finally{await context.close();}
}
