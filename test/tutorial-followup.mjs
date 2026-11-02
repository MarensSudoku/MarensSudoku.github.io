import assert from 'node:assert/strict';
import {STORAGE_KEY} from '../web/storage.mjs';
import {REEF_STORAGE_KEY} from '../web/reef-layout.mjs';

export async function checkTutorialFollowup(browser,name,base) {
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
  try {
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.board-shell.ready').waitFor();
    const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).game,STORAGE_KEY);
    const reef=await page.evaluate(key=>localStorage.getItem(key),REEF_STORAGE_KEY);
    const finishBasics=async()=>{
      await page.locator('#tour-dialog').waitFor({state:'visible'});
      const steps=Number((await page.locator('#tour-step').textContent()).match(/\d+$/)[0]);
      assert.equal(steps,11);
      for(let i=0;i<steps;i++)await page.locator('#tour-next').click();
      await page.locator('#confirm-dialog').waitFor({state:'visible'});
      assert.ok((await page.locator('#confirm-copy').textContent()).includes('Möchtest du auch das Riff-Tutorial machen?'));
      assert.ok((await page.locator('#confirm-copy').textContent()).includes('„Hilfe & Infos“'));
      for(const topic of ['Riff im Hintergrund','Fische und Korallen','Farben','Schwimmwege'])assert.ok((await page.locator('#confirm-copy').textContent()).includes(topic));
      assert.equal(await page.locator('#confirm-yes').textContent(),'Riff-Tutorial');
      assert.equal(await page.locator('#confirm-no').textContent(),'Später');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-no');
    };
    await page.locator('#welcome-tour').click();await finishBasics();
    for(const [width,height] of [[240,320],[390,780],[667,375],[1280,900]]) {
      await page.setViewportSize({width,height});
      assert.equal(await page.locator('#confirm-dialog').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&node.scrollWidth<=node.clientWidth;}),true,'the follow-up must fit portrait and landscape without horizontal scrolling');
      if(width===390||width===1280)await page.screenshot({path:`output/${name}-tutorial-offer${width===390?'-mobile':''}.png`});
    }
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('dialog[open]').count(),0,'Later returns to Sudoku');
    assert.equal(await page.locator('#hint, #hint-dialog').count(),0);
    assert.equal(await page.locator('.game-tools button').count(),5);
    await page.screenshot({path:`output/${name}-v14-no-hint.png`});
    await page.setViewportSize({width:390,height:780});
    await page.screenshot({path:`output/${name}-v14-no-hint-mobile.png`});
    await page.setViewportSize({width:1280,height:900});
    await page.locator('#help-open').click();assert.equal(await page.locator('#help-reef-tour').isVisible(),true);
    await page.locator('#help-tour').click();await finishBasics();await page.locator('#confirm-yes').click();
    await page.waitForFunction(()=>document.getElementById('tour-dialog').open&&document.getElementById('tour-dialog').dataset.step==='tourEditorIntro');
    assert.equal(await page.locator('#reef-editor').isVisible(),true,'accepting starts the real reef tutorial');
    await page.locator('#tour-skip').click();assert.equal(await page.locator('#confirm-dialog').isVisible(),false,'ending the reef tutorial must not ask again');
    await page.locator('#help-open').click();await page.locator('#help-tour').click();await page.locator('#tour-skip').click();
    assert.equal(await page.locator('#confirm-dialog').isVisible(),false,'skipping Sudoku must not offer another tutorial');
    await page.locator('#help-open').click();await page.locator('#help-tour').click();await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(),0,'Escape skips without a follow-up');
    await page.locator('#new-game').click();
    assert.equal(await page.locator('#confirm-yes').textContent(),'Bestätigen');
    assert.equal(await page.locator('#confirm-no').textContent(),'Abbrechen');
    await page.locator('#confirm-no').click();
    const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).game,STORAGE_KEY);
    assert.deepEqual(after.values,before.values);assert.deepEqual(after.notes,before.notes);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),REEF_STORAGE_KEY),reef);
    assert.deepEqual(errors,[]);
    console.log(`${name}: tutorial follow-up, later, direct reef start, Info access, skip/Escape, keyboard, mobile layout and saved game preservation passed.`);
  }finally{await context.close();}
}
