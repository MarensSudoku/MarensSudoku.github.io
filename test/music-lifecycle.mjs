import assert from 'node:assert/strict';

export async function checkMusicLifecycle(browser,name,base) {
  const context=await browser.newContext({locale:'en-US',reducedMotion:'reduce',serviceWorkers:'block'});
  try {
    await context.addInitScript(()=>{
      if(!navigator.mediaSession)Object.defineProperty(navigator,'mediaSession',{value:{playbackState:'none',metadata:null}});
      // Reproduce browser bookkeeping arriving after stop() but before the element's emptied handler.
      document.addEventListener('emptied',event=>{
        if(event.target.id==='reef-music'&&!event.target.hasAttribute('src')&&document.hidden){
          navigator.mediaSession.playbackState='playing';
          navigator.mediaSession.metadata=window.MediaMetadata?new MediaMetadata({title:'Late media state'}):{title:'Late media state'};
        }
      },true);
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.board-shell.ready').waitFor();await page.locator('#welcome-start').click();
    await page.waitForFunction(()=>!document.getElementById('reef-music').paused);
    await page.locator('#reef-music').evaluate(audio=>{audio.currentTime=12;});
    await page.waitForFunction(()=>{const audio=document.getElementById('reef-music');return !audio.seeking&&audio.currentTime>=12;});
    const before=await page.evaluate(()=>{
      const audio=document.getElementById('reef-music'),started=performance.now(),position={src:audio.currentSrc,time:audio.currentTime};
      if(navigator.mediaSession){navigator.mediaSession.playbackState='playing';if(window.MediaMetadata)navigator.mediaSession.metadata=new MediaMetadata({title:'Reef music'});}
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      dispatchEvent(new Event('pagehide'));
      return {...position,stopDelay:(performance.now()-started)/1000};
    });
    // Without a source the media element reaches NETWORK_EMPTY one task after load(); WebKit may still report NO_SOURCE before that.
    await page.waitForFunction(()=>document.getElementById('reef-music').networkState===0,null,{timeout:2000}).catch(()=>{});
    const stopped=await page.locator('#reef-music').evaluate(audio=>({paused:audio.paused,src:audio.getAttribute('src'),networkState:audio.networkState,readyState:audio.readyState}));
    assert.deepEqual(stopped,{paused:true,src:null,networkState:0,readyState:0},'backgrounding must unload the player completely');
    assert.equal(await page.evaluate(()=>navigator.mediaSession?.playbackState??'none'),'none');
    assert.equal(await page.evaluate(()=>navigator.mediaSession?.metadata??null),null);
    await page.evaluate(()=>{
      const audio=document.getElementById('reef-music'),started=performance.now();window.__musicResume=null;
      const capture=()=>{
        if(audio.paused||audio.seeking||audio.readyState<2)return;
        window.__musicResume={src:audio.currentSrc,time:audio.currentTime,elapsed:(performance.now()-started)/1000};
        audio.removeEventListener('playing',capture);audio.removeEventListener('seeked',capture);
      };
      audio.addEventListener('playing',capture);audio.addEventListener('seeked',capture);
      delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));capture();
    });
    await page.waitForFunction(()=>window.__musicResume);
    const resumed=await page.evaluate(()=>window.__musicResume);
    assert.equal(resumed.src,before.src);
    assert.ok(resumed.time>=before.time-.1,'returning must not restart the track');
    // Audio advances while a slow runner delivers events and executes later browser commands.
    assert.ok(resumed.time<=before.time+before.stopDelay+resumed.elapsed+.5,'returning must continue near the stored position');
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
