import assert from 'node:assert/strict';
import {RELEASE} from '../web/release.mjs';
import {chooseLanguage} from './language.mjs';

export async function checkInstallGuide(browser,name,base) {
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'de-DE',serviceWorkers:'block',reducedMotion:'no-preference'});
  try {
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.board-shell.ready').waitFor();
    assert.equal(await page.locator('#welcome-tutorial-hint').count(),0);
    assert.equal(await page.locator('#welcome-dialog [data-t=welcomeCopy]').textContent(),'Mach es dir gemütlich. Dein Sudoku und dein eigenes Riff warten auf dich.');
    assert.equal(await page.locator('#welcome-tour').evaluate(node=>getComputedStyle(node).animationName),'tutorial-invite');
    assert.equal(await page.locator('#welcome-install').evaluate(node=>node.tagName==='BUTTON'&&node.classList.contains('quiet-button')),true);
    assert.equal(await page.locator('#install-guide').evaluate(node=>node.open),false,'the install section must start collapsed');
    await page.screenshot({path:`output/${name}-welcome-v5.png`});
    const address=page.url();
    await page.locator('#welcome-install').focus();await page.keyboard.press('Enter');
    await page.locator('#help-dialog').waitFor({state:'visible'});
    assert.equal(page.url(),address,'the install guide must open without navigating');
    assert.equal(await page.locator('#welcome-dialog').evaluate(node=>node.open),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'install-title');
    assert.equal(await page.locator('#install-guide').evaluate(node=>node.open),true,'the welcome button must expand the install section');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-t=installIntro]').isVisible(),false);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-t=installIntro]').isVisible(),true);
    assert.equal(await page.locator('#install-title').isVisible(),true);
    assert.equal(await page.locator('#install-guide details').count(),4);
    for(const details of await page.locator('#install-guide details').all()) {
      await details.locator('summary').click();
      assert.equal(await details.locator('li:visible').count(),3);
      await details.locator('summary').click();
    }
    await page.locator('#install-guide details summary').first().click();
    await page.locator('#install-guide').scrollIntoViewIfNeeded();
    await page.screenshot({path:`output/${name}-install-guide-v5.png`});
    await page.locator('#install-title').click();
    assert.equal(await page.locator('#legal-guide').evaluate(node=>node.open),false);
    assert.equal(await page.locator('#legal-guide details summary:visible').count(),0);
    await page.locator('#legal-title').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#legal-guide details summary:visible').count(),7);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#source-link').isVisible(),true);
    assert.equal(await page.locator('#source-link').getAttribute('href'),'https://github.com/MarensSudoku/MarensSudoku.github.io');
    assert.equal(await page.locator('#help-content a').count(),0,'source access must be a separate top-level button');
    assert.equal(await page.locator('#release-notes-title').innerText(),`Version ${RELEASE.version} · Neues`);
    assert.equal(await page.locator('#app-release-date').isVisible(),false);
    await page.locator('#release-notes-title').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#app-release-date').isVisible(),true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#help-dialog .dialog-body > .app-version').count(),0);
    await page.screenshot({path:`output/${name}-info-overview-v5.png`});
    await page.locator('#help-dialog .dialog-close').click();
    await chooseLanguage(page,'en');
    await page.locator('#settings-dialog .dialog-close').click();await page.locator('#help-open').click();
    assert.equal(await page.locator('#install-title').textContent(),'Install MarensSudoku as an app');
    assert.equal(await page.locator('#release-notes-title').innerText(),`Version ${RELEASE.version} · What’s new`);
    assert.ok((await page.locator('[data-install-steps=installDesktop] li').first().textContent()).startsWith('Open MarensSudoku'));
    assert.ok((await page.locator('[data-t=installNote]').textContent()).includes('not transferred automatically'));
    await page.locator('#help-dialog .dialog-close').click();
    await page.setViewportSize({width:320,height:568});await page.reload();
    await page.locator('#welcome-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#welcome-install').textContent(),'Install as an app');
    await page.screenshot({path:`output/${name}-welcome-mobile-v5.png`});
    await page.locator('#welcome-install').click();
    await page.locator('#install-guide details summary').first().click();
    await page.locator('#install-title').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#help-dialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true,'mobile guide must not overflow horizontally');
    await page.screenshot({path:`output/${name}-install-mobile-v5.png`});
    await page.setViewportSize({width:667,height:375});
    assert.equal(await page.locator('#install-guide li').first().isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log(`${name}: install guide, welcome link, tutorial invitation, both languages, keyboard and mobile layout passed.`);
  } finally {await context.close();}
}
