import assert from 'node:assert/strict';
import {REEF_STORAGE_KEY} from '../web/reef-layout.mjs';

export async function checkTutorial(page,name) {
  const savedReef=await page.evaluate(key=>localStorage.getItem(key),REEF_STORAGE_KEY),seen=new Set();
  const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);
  // HTTP LAN previews do not expose randomUUID.
  await page.evaluate(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true}));
  await page.locator('#welcome-tour')[touch?'tap':'click']();
  await page.waitForFunction(()=>!document.getElementById('tour-next').disabled&&document.getElementById('tour-dialog').dataset.step);
  const editor=await page.locator('#reef-aquarium').getAttribute('data-status')==='ready';
  const total=Number((await page.locator('#tour-step').textContent()).match(/\d+$/)[0]);
  assert.ok(total>=(editor?30:18),'the tutorial must cover Sudoku colours and every available editor control');
  for(let step=1;step<=total;step++){
    const key=await page.locator('#tour-dialog').getAttribute('data-step');seen.add(key);
    assert.ok(await page.locator('.tour-target').count()>0,`${key}: a visible control or example must be highlighted`);
    assert.ok((await page.locator('#tour-title').textContent()).length>0);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tour-next');
    assert.equal(await page.locator('#tour-bubble').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),true,`${key}: tutorial must fit the viewport`);
    if(key==='tourMatching')assert.ok(await page.locator('.cell.is-matching.tour-target').count()>0,'matching-number examples must actually be yellow');
    if(key==='tourErrors'){
      const example=page.locator('.cell[aria-invalid=true].tour-target');
      assert.ok(await example.count()>0);
      for(const selected of ['false','true']){
        await example.evaluate((cell,selected)=>cell.setAttribute('aria-selected',selected),selected);
        const [r,g,b,a=1]=await example.evaluate(cell=>getComputedStyle(cell).backgroundColor.match(/[\d.]+/g).map(Number));
        assert.ok(r-Math.max(g,b)>60&&a===1,`the error example must have an opaque red background, including when selected: ${r},${g},${b},${a}`);
      }
      await example.evaluate(cell=>cell.setAttribute('aria-selected','false'));
    }
    if(key.startsWith('tourEditor'))assert.equal(await page.locator('#reef-editor').isVisible(),true,'the editor must actually open during its tutorial');
    if(key==='tourEditorColor')assert.equal(await page.locator('#reef-properties-dialog').isVisible(),true);
    if(key==='tourEditorFish')assert.equal(await page.locator('#reef-fish-settings').getAttribute('open')!==null,true);
    if(key==='tourEditorCatalog'||key==='tourEditorList')assert.equal(await page.locator('#reef-picker-dialog').isVisible(),true);
    if(['tourErrors','tourEditorSelect','tourEditorCatalog','tourEditorFish'].includes(key))await page.screenshot({path:`output/${name}-${key}.png`});
    await page.waitForTimeout(step===1?1100:0);
    await page.locator('#tour-next')[touch?'tap':'click']();
  }
  for(const key of ['tourFocus','tourMatching','tourErrors','tourPadColors'])assert.ok(seen.has(key));
  if(editor)for(const key of ['tourEditorSelect','tourEditorRotate','tourEditorFish','tourEditorList','tourEditorSave'])assert.ok(seen.has(key));
  assert.equal(await page.locator('#tour-dialog').evaluate(node=>node.open),false);
  assert.equal(await page.locator('#reef-editor').isHidden(),true);
  assert.equal(await page.locator('#reef-picker-dialog, #reef-properties-dialog').evaluateAll(nodes=>nodes.every(node=>!node.open)),true);
  assert.equal(await page.locator('.tour-target').count(),0);
  assert.equal(await page.locator('.site-header').evaluate(node=>node.inert),false);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),REEF_STORAGE_KEY),savedReef,'the example reef must never overwrite the saved arrangement');
  console.log(`${name}: ${total} tutorial steps, Sudoku colour examples, real editor panels and saved-reef restoration passed.`);
}
