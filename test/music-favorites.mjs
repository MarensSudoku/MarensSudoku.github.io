import assert from 'node:assert/strict';
import {chooseLanguage} from './language.mjs';

export async function checkMusicFavorites(browser,name,base){
  const context=await browser.newContext({viewport:{width:390,height:664},locale:'de-DE',reducedMotion:'reduce',serviceWorkers:'block'});
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('#welcome-start').click();await page.locator('#settings-open').click();
    await page.waitForFunction(()=>document.querySelector('#music-track').options.length===20);
    await page.locator('.music-playlist summary').click();
    const first='12-sonnentanz-in-der-lagune.mp3',second='15-karibik-vollgas.mp3',other='20-ukulele-auf-wellen.mp3';
    const heart=file=>page.locator(`[data-favorite="${file}"]`);
    const playing=()=>page.waitForFunction(()=>{const audio=document.querySelector('#reef-music');return !audio.paused&&audio.currentTime>0;});
    const selected=()=>page.locator('#music-track').inputValue();
    const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('marenssudoku:state:v1')).settings);
    const listed=()=>page.locator('#music-track option').evaluateAll(options=>options.map(option=>option.value));
    const original=await selected();
    await heart(first).click();await heart(second).click();
    assert.equal(await selected(),original,'marking favourites must not change the current song');
    await heart(other).focus();await page.keyboard.press('Space');
    assert.equal(await heart(other).getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.favorite),other,'updating the playlist must retain keyboard focus');
    await page.keyboard.press('Space');
    await page.locator('#music-favorites-only').click();await playing();
    assert.deepEqual(await listed(),[first,second]);
    assert.ok([first,second].includes(await selected()));
    assert.equal(await page.locator(`[data-music-play="${other}"]`).isDisabled(),true);
    for(let i=0;i<3;i++){await page.locator('#music-next').click();await playing();assert.ok([first,second].includes(await selected()));}
    await page.locator('#music-shuffle').click();
    const before=await selected();await page.locator('#music-next').click();await playing();
    assert.notEqual(await selected(),before);
    await page.locator('#reef-music').evaluate(audio=>{audio.currentTime=0;});
    await page.locator('#music-previous').click();await playing();assert.equal(await selected(),before);
    await page.locator('#reef-music').evaluate(audio=>{audio.currentTime=audio.duration-.15;});
    await page.waitForFunction(before=>document.querySelector('#music-track').value!==before,before);await playing();
    assert.ok([first,second].includes(await selected()),'automatic advance must stay within favourites');
    await page.reload();await page.locator('#welcome-start').click();await page.locator('#settings-open').click();
    await page.waitForFunction(()=>document.querySelector('#music-track').options.length===2);
    assert.deepEqual((await saved()).musicFavorites,[first,second]);
    assert.equal((await saved()).musicFavoritesOnly,true);
    await page.locator('.music-playlist summary').click();
    await page.locator('#music-favorites-only').click();assert.equal((await listed()).length,20);
    await page.locator(`[data-music-play="${other}"]`).click();await playing();assert.equal(await selected(),other);
    await page.locator('#music-favorites-only').click();await playing();assert.ok([first,second].includes(await selected()));
    await page.locator('#music-toggle').click();
    await heart(first).click();assert.equal(await page.locator('#reef-music').evaluate(audio=>audio.paused),true,'editing favourites must preserve a manual pause');
    await heart(second).click();
    assert.deepEqual(await listed(),[]);
    assert.equal(await page.locator('#reef-music').getAttribute('src'),null,'an empty favourites queue must release the audio');
    assert.equal(await page.locator('#music-toggle').isDisabled(),true);
    assert.ok((await page.locator('#music-status').textContent()).includes('Herz'));
    await heart(first).click();assert.equal(await page.locator('#reef-music').evaluate(audio=>audio.paused),true);
    await page.locator('#music-toggle').click();await playing();assert.equal(await selected(),first);
    await heart(first).click();
    await page.reload();await page.locator('#welcome-start').click();await page.locator('#settings-open').click();
    await page.waitForFunction(()=>document.querySelector('#music-status').textContent.includes('Herz'));
    assert.equal(await page.locator('#reef-music').getAttribute('src'),null,'an empty saved favourites list must remain silent after reload');
    await page.locator('.music-playlist summary').click();await heart(first).click();await playing();
    await chooseLanguage(page,'he');
    assert.equal(await page.locator('#music-favorites-only').getAttribute('aria-label'),'רק מועדפים');
    assert.ok((await heart(first).getAttribute('aria-label')).includes('ריקוד השמש'));
    await page.screenshot({path:`output/${name}-music-favorites.png`});
    await page.setViewportSize({width:240,height:320});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('#settings-dialog').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth),true,'the player and playlist must fit a small mobile dialog');
    assert.deepEqual(errors,[]);
    console.log(`${name}: music favourites, keyboard focus, filtered next/previous/shuffle/end, persistence, empty queue, manual pause, RTL and 240px passed.`);
  }finally{await context.close();}
}
