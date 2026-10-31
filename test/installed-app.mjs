import assert from 'node:assert/strict';

export async function checkInstalledApp(browser,name,base) {
  for(const mode of ['browser','standalone','ios']) {
    const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'});
    try {
      await context.addInitScript(mode=>{
        if(mode==='standalone'){
          const match=window.matchMedia.bind(window);
          window.matchMedia=query=>match(query==='(display-mode: standalone)'?'all':query);
        }
        if(mode==='ios')Object.defineProperty(navigator,'standalone',{value:true});
      },mode);
      const page=await context.newPage();await page.goto(base);
      await page.locator('#welcome-dialog').waitFor({state:'visible'});
      assert.equal(await page.locator('#welcome-install').isVisible(),mode==='browser',`${mode}: install button visibility`);
      if(mode==='browser'){
        await page.evaluate(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.installPrompted=true;};dispatchEvent(event);});
        await page.locator('#welcome-install').click();
        assert.equal(await page.evaluate(()=>window.installPrompted),true,'an offered browser install dialog must open from the welcome button');
        assert.equal(await page.locator('#help-dialog').isVisible(),false,'the browser install dialog replaces the written guide');
        await page.evaluate(()=>dispatchEvent(new Event('appinstalled')));
        assert.equal(await page.locator('#welcome-install').isVisible(),false,'installing from this page must hide the button immediately');
      }
      await page.locator('#welcome-start').click();await page.locator('#help-open').click();
      assert.equal(await page.locator('#install-title').isVisible(),true,'installation help must remain available in Info');
    } finally {await context.close();}
  }
  console.log(`${name}: browser, standalone, iOS and completed-install welcome states passed.`);
}
