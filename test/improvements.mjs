import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reefObject, REEF_STORAGE_KEY } from '../web/reef-layout.mjs';
import { STORAGE_KEY } from '../web/storage.mjs';

export async function checkImprovements(browser,name,base) {
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true});
  try {
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
    await page.goto(base);await page.locator('.board-shell.ready').waitFor();await page.locator('#welcome-start').click();
    assert.equal(await page.locator('#hint, #hint-dialog').count(),0);
    assert.equal(await page.locator('.game-tools button').count(),5);
    await page.waitForFunction(()=>document.getElementById('reef-aquarium').dataset.status==='ready');
    const width=await page.locator('#reef-aquarium').evaluate(canvas=>canvas.width);
    await page.locator('#settings-open').click();await page.locator('#energy-saver').check();
    const savedWidth=await page.locator('#reef-aquarium').evaluate(canvas=>canvas.width);
    assert.ok(savedWidth<width,'energy saving must reduce actual render resolution');
    assert.equal((await read()).settings.energySaver,true);
    await page.locator('#energy-saver').uncheck();assert.equal(await page.locator('#reef-aquarium').evaluate(canvas=>canvas.width),width);
    await page.locator('#energy-saver').check();await page.locator('#remember-music').check();
    await page.waitForFunction(()=>!document.getElementById('reef-music').paused);
    await page.locator('#music-toggle').click();await page.locator('#music-mute').click();
    await page.reload();await page.locator('.board-shell.ready').waitFor();await page.locator('#welcome-start').click();
    await page.locator('#settings-open').click();
    assert.equal(await page.locator('#reef-music').evaluate(audio=>audio.paused&&audio.muted),true);
    assert.equal(await page.locator('#remember-music').isChecked(),true);
    assert.equal(await page.locator('#energy-saver').isChecked(),true);
    const reef={schema:1,objects:[reefObject('clownfish','backup-fish',{hue:85})]};
    await page.evaluate(({key,reef})=>localStorage.setItem(key,JSON.stringify(reef)),{key:REEF_STORAGE_KEY,reef});
    await page.locator('.backup-section summary').click();
    const downloading=page.waitForEvent('download');await page.locator('#backup-export').click();
    const download=await downloading, buffer=await readFile(await download.path()), backup=JSON.parse(buffer);
    assert.ok(download.suggestedFilename().startsWith('MarensSudoku-'));
    assert.deepEqual(backup.reef,reef);assert.deepEqual(backup.state.scores,(await read()).scores);
    await page.locator('#backup-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await page.waitForFunction(()=>document.getElementById('backup-status').textContent.includes('Ungültige'));
    assert.ok((await page.locator('#backup-status').textContent()).includes('Ungültige'));
    const upload=()=>page.locator('#backup-file').setInputFiles({name:'saved.json',mimeType:'application/json',buffer});
    await page.locator('#energy-saver').uncheck();
    await upload();await page.locator('#confirm-no').click();assert.equal((await read()).settings.energySaver,false);
    await upload();await page.locator('#confirm-yes').click();
    await page.locator('#welcome-dialog').waitFor({state:'visible'});await page.locator('.board-shell.ready').waitFor();
    const restored=await read();
    assert.deepEqual(restored.game,backup.state.game,'pagehide must not overwrite the restored game');
    assert.equal(restored.settings.energySaver,true);assert.equal(restored.settings.musicEnabled,false);
    assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),reef);
    assert.deepEqual(errors,[]);
    console.log(`${name}: five Sudoku controls, real render resolution, remembered pause/mute, native backup download, invalid/cancelled import and complete restore passed.`);
  } finally { await context.close(); }
}
