import assert from 'node:assert/strict';

export async function checkWaiting(browser,name,base) {
  const context=await browser.newContext({viewport:{width:375,height:559},locale:'de-DE',reducedMotion:'no-preference',serviceWorkers:'block'});
  let releasePuzzle,releaseReef;
  const puzzle=new Promise(resolve=>releasePuzzle=resolve);
  let reef=new Promise(resolve=>releaseReef=resolve);
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/sudoku/worker.mjs',async route=>{await puzzle;await route.continue();});
    await page.route('**/game/aquarium.mjs',async route=>{await reef;await route.continue();});
    const reefRequested=page.waitForRequest('**/game/aquarium.mjs');
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const check=async()=>{
      await page.locator('#loading').waitFor({state:'visible'});
      assert.equal(await page.locator('#loading').evaluate(dialog=>dialog.matches(':modal')),true);
      assert.equal(await page.locator('#loading button, #loading input, #loading a').count(),0,'waiting dialogs must not offer actions');
      assert.equal(await page.locator('.waiting-spinner').evaluate(node=>getComputedStyle(node).animationName),'waiting-spin');
      assert.equal(await page.locator('#loading').evaluate(node=>{const r=node.getBoundingClientRect();return Math.abs(r.left+r.width/2-innerWidth/2)<1&&Math.abs(r.top+r.height/2-innerHeight/2)<1;}),true,'waiting dialogs must be centred on the screen');
      await page.keyboard.press('Escape');assert.equal(await page.locator('#loading').isVisible(),true,'Escape must not dismiss an unfinished operation');
    };
    await check();if(name==='chromium')await page.screenshot({path:`output/${name}-waiting-puzzle.png`});
    releasePuzzle();await page.locator('.board-shell.ready').waitFor();await page.locator('#loading').waitFor({state:'hidden'});
    await reefRequested;
    assert.equal(await page.locator('#welcome-dialog').evaluate(node=>node.open),true,'the reef must begin loading while the welcome dialog is still open');
    await page.locator('#welcome-start').click();await check();
    assert.equal(await page.locator('#loading-label').textContent(),'Riff wird vorbereitet');
    assert.equal(await page.locator('#welcome-dialog').evaluate(node=>node.open),false);
    if(name==='chromium')await page.screenshot({path:`output/${name}-waiting-start.png`});
    releaseReef();await page.locator('#loading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#reef-aquarium').getAttribute('data-status'),'ready');
    assert.equal(await page.locator('#board').isVisible(),true);
    reef=new Promise(resolve=>releaseReef=resolve);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#welcome-tour').click();await check();
    assert.equal(await page.locator('#loading-label').getAttribute('data-t'),'reefLoading');
    if(name==='chromium')await page.screenshot({path:`output/${name}-waiting-reef.png`});
    releaseReef();await page.locator('#tour-dialog').waitFor({state:'visible'});await page.locator('#loading').waitFor({state:'hidden'});
    await page.locator('#tour-skip').click();
    await page.unroute('**/game/aquarium.mjs');
    await page.route('**/game/aquarium.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export async function createAquarium(canvas){canvas.dataset.status="unavailable";return null;}'}));
    await page.reload();await page.waitForFunction(()=>document.getElementById('reef-aquarium').dataset.status==='unavailable');
    await page.locator('#welcome-start').click();await page.locator('#loading').waitFor({state:'hidden'});
    assert.equal(await page.locator('#welcome-dialog').evaluate(node=>node.open),false,'unavailable 3D must not block starting the Sudoku');
    assert.deepEqual(errors,[]);
    console.log(`${name}: puzzle, starting play and tutorial use centred modal spinners; ready or unavailable 3D releases the game.`);
  }finally{releasePuzzle();releaseReef();await context.close();}
}
