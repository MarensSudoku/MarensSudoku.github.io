import assert from 'node:assert/strict';

export async function checkMusicLifecycle(browser,name,base) {
  const context=await browser.newContext({locale:'en-US',reducedMotion:'reduce',serviceWorkers:'block'});
  try {
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.board-shell.ready').waitFor();await page.locator('#welcome-start').click();
    await page.waitForFunction(()=>!document.getElementById('reef-music').paused);
    await page.locator('#reef-music').evaluate(audio=>{audio.currentTime=12;});
    await page.waitForFunction(()=>{const audio=document.getElementById('reef-music');return !audio.seeking&&audio.currentTime>=12;});
    const before=await page.locator('#reef-music').evaluate(audio=>({src:audio.currentSrc,time:audio.currentTime}));
    await page.evaluate(()=>{
      if(navigator.mediaSession){navigator.mediaSession.playbackState='playing';if(window.MediaMetadata)navigator.mediaSession.metadata=new MediaMetadata({title:'Reef music'});}
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      dispatchEvent(new Event('pagehide'));
    });
    const stopped=await page.locator('#reef-music').evaluate(audio=>({paused:audio.paused,src:audio.getAttribute('src'),networkState:audio.networkState,readyState:audio.readyState}));
    assert.deepEqual(stopped,{paused:true,src:null,networkState:0,readyState:0},'backgrounding must unload the player completely');
    assert.equal(await page.evaluate(()=>navigator.mediaSession?.playbackState??'none'),'none');
    assert.equal(await page.evaluate(()=>navigator.mediaSession?.metadata??null),null);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(time=>{const audio=document.getElementById('reef-music');return !audio.paused&&!audio.seeking&&audio.currentTime>=time-.1;},before.time);
    assert.equal(await page.locator('#reef-music').evaluate(audio=>audio.currentSrc),before.src);
    assert.ok(await page.locator('#reef-music').evaluate((audio,time)=>audio.currentTime<time+3,before.time),'returning must continue near the stored position');
    await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
    assert.equal(await page.locator('#reef-music').getAttribute('src'),null,'pagehide must release the source even without visibilitychange');
    await page.evaluate(()=>dispatchEvent(new Event('pageshow')));
    await page.waitForFunction(()=>!document.getElementById('reef-music').paused);
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      const audio=document.getElementById('reef-music'),play=audio.play;
      audio.play=function(){this.play=play;return Promise.reject(new DOMException('Gesture required','NotAllowedError'));};
      delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(()=>document.getElementById('music-status').textContent.includes('Tap the game'));
    await page.locator('.cell').first().click();
    await page.waitForFunction(()=>!document.getElementById('reef-music').paused);
    await page.locator('#settings-open').click();await page.locator('#music-toggle').click();
    await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new Event('pageshow'));
    });
    assert.equal(await page.locator('#reef-music').evaluate(audio=>audio.paused),true,'a manual music pause must remain respected');
    assert.equal(await page.locator('#reef-music').getAttribute('src'),null);
    assert.deepEqual(errors,[]);
    console.log(`${name}: background audio unload, cleared media session, saved-position resume, page lifecycle, autoplay retry and manual pause passed.`);
  } finally {await context.close();}
}
