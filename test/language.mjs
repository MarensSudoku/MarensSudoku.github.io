import assert from 'node:assert/strict';
import { LOCALES } from '../web/locales.mjs';
import { RELEASE } from '../web/release.mjs';

export async function chooseLanguage(page, code) {
  if (!await page.locator('#settings-dialog').evaluate(node => node.open)) await page.locator('#settings-open').click();
  await page.locator('#language-toggle').click();
  await page.locator(`#language-options [data-language="${code}"]`).click();
  await page.waitForFunction(code => document.documentElement.lang === code, code);
}

// A missing translation would surface as its raw key in text, labels or titles.
async function rawKeys(page, code) {
  const ui = (await import(`../web/i18n/${code}.mjs`)).default;
  return page.evaluate(keys => {
    const known = new Set(keys), found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (known.has(walker.currentNode.nodeValue.trim())) found.push(walker.currentNode.nodeValue.trim());
    for (const node of document.querySelectorAll('[aria-label],[title]')) for (const value of [node.getAttribute('aria-label'), node.title]) if (known.has(value)) found.push(value);
    return [...new Set(found)];
  }, Object.keys(ui).filter(key => ui[key] !== key));
}

export async function checkLanguages(browser, name, base) {
  const context = await browser.newContext({ viewport:{ width:1440, height:900 }, locale:'de-DE', reducedMotion:'reduce', serviceWorkers:'block' });
  try {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.locator('.board-shell.ready').waitFor(); await page.locator('#welcome-start').click();
    await page.locator('#settings-open').click();
    const focused = () => page.evaluate(() => document.activeElement.dataset.language || document.activeElement.id);
    await page.locator('#language-toggle').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#language-toggle').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#language-options [role=option]').count(), Object.keys(LOCALES).length);
    assert.equal(await page.locator('#language-options [aria-selected=true]').getAttribute('aria-label'), 'Deutsch');
    assert.equal(await focused(), 'de');
    await page.keyboard.press('ArrowRight'); assert.equal(await focused(), 'en');
    await page.keyboard.press('End'); assert.equal(await focused(), Object.keys(LOCALES).at(-1));
    await page.keyboard.press('Home'); assert.equal(await focused(), 'de');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#language-options').isHidden(), true);
    assert.equal(await page.locator('#settings-dialog').evaluate(node => node.open), true, 'Escape must close only the flag menu');
    assert.equal(await focused(), 'language-toggle');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await focused(), 'language-toggle');
    assert.equal(await page.locator('#language-toggle').getAttribute('aria-label'), 'Choose language: English');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('marenssudoku:state:v1')).settings.language), 'en');
    for (const [code, locale] of Object.entries(LOCALES)) {
      await chooseLanguage(page, code);
      assert.deepEqual(await rawKeys(page, code), [], `${name} ${code}: untranslated keys`);
      assert.equal(await page.evaluate(() => document.documentElement.dir), locale.dir || 'ltr');
      assert.equal(await page.locator('#board-shell').evaluate(node => getComputedStyle(node).direction), 'ltr', `${code}: the board keeps its column order`);
      assert.deepEqual(await page.locator('#release-notes li').allTextContents(), RELEASE.notes[code]);
      assert.equal(await page.locator('[data-legal]:not([hidden])').count(), ['de','en'].includes(code) ? code === 'de' ? 3 : 4 : 7, `${code}: legal reading aids`);
      assert.equal(await page.locator('#legal-commons .legal-original pre').count(), 1, 'the original licence stays in place');
    }
    await chooseLanguage(page, 'de');
    assert.deepEqual(errors, [], `${name}: browser errors`);
    await context.close();
    const phone = await browser.newContext({ viewport:{ width:375, height:812 }, hasTouch:true, locale:'pt-BR', reducedMotion:'reduce', serviceWorkers:'block' });
    const mobile = await phone.newPage(); mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(base); await mobile.locator('.board-shell.ready').waitFor();
    assert.equal(await mobile.evaluate(() => document.documentElement.lang), 'pt-BR', 'the browser language is the default');
    await mobile.locator('#welcome-start').tap();
    for (const [width, height, code] of [[375, 812, 'sv'], [812, 375, 'es'], [1440, 900, 'fr']]) {
      await mobile.setViewportSize({ width, height });
      await mobile.locator('#settings-open').tap(); await mobile.locator('#language-toggle').tap();
      const option = mobile.locator(`#language-options [data-language="${code}"]`);
      await option.scrollIntoViewIfNeeded();
      const box = await option.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height, `${width}x${height}: ${JSON.stringify(box)}`);
      assert.equal(await mobile.locator('#settings-dialog .dialog-body').evaluate(node => node.scrollWidth <= node.clientWidth), true, `${width}x${height}: no sideways scrolling`);
      await mobile.screenshot({ path:`output/${name}-languages-${width}x${height}.png` });
      await option.tap(); await mobile.waitForFunction(code => document.documentElement.lang === code, code);
      await mobile.locator('#settings-dialog .dialog-close').tap();
    }
    assert.deepEqual(errors, [], `${name}: mobile browser errors`);
    await phone.close();
    console.log(`${name}: flag language menu, keyboard, ${Object.keys(LOCALES).length} complete languages, RTL and mobile layouts passed.`);
  } finally { await context.close().catch(() => {}); }
}
