import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4175/';
await mkdir('output', { recursive: true });
for (const [name, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, locale: 'de-DE' });
  await context.addInitScript(() => {
    window.__audioGesture = false; window.__sfxPlayed = 0; window.__sfxDecoded = 0;
    addEventListener('click', () => { window.__audioGesture = true; }, true);
    addEventListener('keydown', () => { window.__audioGesture = true; }, true);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.id === 'reef-music' && !window.__audioGesture) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
      if (this.src.includes('/assets/sounds/')) window.__sfxPlayed++;
      return play.apply(this, args);
    };
    window.__sfxAudioTags = [];
    const OriginalAudio = window.Audio;
    window.Audio = function (...args) { const audio = new OriginalAudio(...args); window.__sfxAudioTags.push(audio); return audio; };
    window.Audio.prototype = OriginalAudio.prototype;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    const prototype = Context.prototype;
    const decode = prototype.decodeAudioData, create = prototype.createBufferSource;
    prototype.decodeAudioData = function (...args) { const result = decode.apply(this, args); result?.then(() => { window.__sfxDecoded++; }).catch(() => {}); return result; };
    prototype.createBufferSource = function (...args) { const node = create.apply(this, args), start = node.start; node.start = function (...values) { window.__sfxPlayed++; return start.apply(this, values); }; return node; };
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(`${name}: ${error.message}`); });
  await page.goto(base);
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('.board-shell.ready').waitFor();
  assert.equal(await page.locator('[role=gridcell]').count(), 81);
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('marenssudoku:state:v1')));
  assert.equal((await read()).settings.musicEnabled, true);
  await page.locator('#settings-open').click();
  await page.waitForFunction(() => document.getElementById('music-track').options.length > 0);
  await page.waitForFunction(() => !document.getElementById('reef-music').paused);
  const tracks = await page.locator('#music-track option').evaluateAll(options => options.map(option => ({ value:option.value, title:option.textContent })));
  assert.ok(tracks.length >= 6);
  assert.equal(tracks[0].value, '02-zwischen-bunten-korallen_1.mp3');
  assert.equal(new Set(tracks.map(track => track.title)).size, tracks.length);
  for (let i = 0; i < tracks.length; i++) {
    await page.locator('#music-track').selectOption(tracks[i].value);
    await page.waitForFunction(file => {
      const audio = document.getElementById('reef-music');
      return audio.currentSrc.endsWith(encodeURIComponent(file)) && !audio.paused && audio.currentTime > 0.05 && Number.isFinite(audio.duration) && audio.duration > 0;
    }, tracks[i].value);
  }
  await page.locator('#music-volume').evaluate(input => { input.value = '37'; input.dispatchEvent(new Event('input', { bubbles:true })); });
  assert.equal(await page.locator('#reef-music').evaluate(audio => audio.volume), 0.37);
  assert.equal((await read()).settings.musicVolume, 0.37);
  assert.equal(await page.locator('#reef-music').evaluate(audio => audio.loop), false);
  const endingTrack = await page.locator('#music-track').inputValue();
  await page.locator('#reef-music').evaluate(audio => { audio.currentTime = audio.duration - 0.15; });
  await page.waitForFunction(file => {
    const audio = document.getElementById('reef-music');
    return document.getElementById('music-track').value !== file && !audio.paused && audio.currentTime > 0.1;
  }, endingTrack);
  const beforeReload = (await read()).settings.musicTrack;
  await page.locator('#music-toggle').click();
  assert.equal(await page.locator('#reef-music').evaluate(audio => audio.paused), true);
  await page.screenshot({ path:`output/${name}-music.png`, fullPage:true });
  await page.reload(); await page.locator('.board-shell.ready').waitFor();
  await page.waitForFunction(() => document.getElementById('music-track').options.length > 0);
  assert.equal(await page.locator('#reef-music').evaluate(audio => audio.paused), true);
  assert.notEqual((await read()).settings.musicTrack, beforeReload);
  assert.equal((await read()).settings.musicVolume, 0.37);
  assert.equal((await read()).settings.musicEnabled, true);
  await page.locator('#settings-open').click();
  await page.waitForFunction(() => { const audio = document.getElementById('reef-music'); return !audio.paused && audio.currentTime > 0.1; });
  await page.screenshot({ path:`output/${name}-music-reload.png`, fullPage:true });
  await page.waitForFunction(() => window.__sfxDecoded === 8 || window.__sfxAudioTags.filter(audio => audio.src.includes('/assets/sounds/')).length === 8);
  const beforeSound = await page.evaluate(() => window.__sfxPlayed);
  await page.locator('#test-sound').click();
  await page.waitForFunction(count => window.__sfxPlayed > count, beforeSound);
  await page.locator('#sfx-enabled').uncheck();
  const mutedCount = await page.evaluate(() => window.__sfxPlayed);
  await page.locator('#test-sound').click();
  assert.equal(await page.evaluate(() => window.__sfxPlayed), mutedCount);
  await page.locator('#sfx-enabled').check();
  await page.locator('#settings-dialog .dialog-close').click();
  console.log(`${name}: ${tracks.length} music files, random next track and reload, click start after pause, eight decoded SFX and sound mute passed.`);
  const initial = await read(), index = initial.game.puzzle.findIndex(n => !n), solution = initial.game.solution[index];
  await page.locator(`[data-index="${index}"]`).click();
  await page.keyboard.press(String(solution));
  assert.equal((await read()).game.values[index], solution);
  await page.locator('#undo').click();
  assert.equal((await read()).game.values[index], 0);
  await page.locator('#notes').click();
  await page.locator(`#number-pad [data-number="${solution}"]`).click();
  assert.equal((await read()).game.notes[index], 1 << solution);
  await page.locator('#notes').click();
  await page.reload();
  await page.locator('.board-shell.ready').waitFor();
  assert.equal((await read()).game.notes[index], 1 << solution);
  await page.locator('#achievements-nav').click();
  await page.locator('#tracking').check();
  await page.locator('#achievements-dialog .dialog-close').click();
  const snapshot = await read();
  for (let i = 0; i < 81; i++) if (!snapshot.game.puzzle[i]) {
    await page.locator(`[data-index="${i}"]`).click();
    await page.keyboard.press(String(snapshot.game.solution[i]));
  }
  await page.locator('#win-dialog').waitFor({ state: 'visible' });
  assert.equal((await read()).progress.total, 1);
  assert.equal((await read()).progress.unlocked.includes('first'), true);
  await page.screenshot({ path: `output/${name}-win.png`, fullPage: true });
  await page.locator('#win-dialog .dialog-close').click();
  await page.locator('#undo').click();
  const afterUndo = await read(), changed = afterUndo.game.values.findIndex((n, i) => n !== afterUndo.game.solution[i]);
  await page.locator(`[data-index="${changed}"]`).click();
  await page.keyboard.press(String(afterUndo.game.solution[changed]));
  assert.equal((await read()).progress.total, 1);
  await page.locator('#achievements-nav').click();
  await page.locator('#tracking').uncheck();
  await page.locator('#confirm-no').click();
  assert.equal(await page.locator('#tracking').isChecked(), true);
  assert.equal((await read()).progress.total, 1);
  await page.locator('#tracking').uncheck(); await page.locator('#confirm-yes').click();
  assert.equal((await read()).settings.tracking, false);
  assert.equal((await read()).progress, null);
  await page.locator('#tracking').check();
  await page.locator('#achievements-dialog .dialog-close').click();
  await page.locator('#new-game').click();
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.screenshot({ path: `output/${name}-desktop.png`, fullPage: true });
  const second = await context.newPage();
  await second.goto(base); await second.locator('#loading').waitFor({ state: 'hidden' });
  assert.equal(await second.locator('#new-game').isDisabled(), true);
  await second.close();
  await page.locator('#difficulty').selectOption('hard');
  await page.locator('#confirm-yes').click();
  await page.locator('#loading').waitFor({ state: 'hidden' });
  assert.equal((await read()).game.difficulty, 'hard');
  await page.locator('#settings-open').click();
  await page.locator('#reduced-motion').check();
  await page.locator('#language').selectOption('en');
  assert.equal(await page.locator('#game-title').textContent(), 'A little reef break');
  await page.locator('#dark-theme').check();
  await page.locator('#settings-dialog .dialog-close').click();
  await page.screenshot({ path: `output/${name}-dark.png`, fullPage: true });
  await page.locator('#settings-open').click();
  await page.locator('#dark-theme').uncheck(); await page.locator('#language').selectOption('de');
  await page.locator('#settings-dialog .dialog-close').click();
  for (const [width, height] of [[320,568],[360,640],[390,664],[390,844],[430,932],[844,390],[667,375],[568,320]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    await page.locator('#update').evaluate(button => { button.hidden = false; });
    const layout = await page.evaluate(() => {
      const board = document.getElementById('board-shell').getBoundingClientRect();
      const controls = ['#board-shell','#difficulty','#notes','#erase','#number-pad button','#new-game','#settings-open','#achievements-nav','footer button','footer a'];
      return {
        fits:document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight,
        square:Math.abs(board.width-board.height)<1, size:Math.min(board.width,board.height),
        visible:controls.every(selector => [...document.querySelectorAll(selector)].filter(el => !el.hidden).every(el => { const r=el.getBoundingClientRect(); return r.width>0 && r.height>0 && r.top>=0 && r.left>=0 && r.bottom<=innerHeight+1 && r.right<=innerWidth+1; })),
      };
    });
    await page.screenshot({ path: `output/${name}-mobile-${width}x${height}.png`, fullPage: true });
    assert.ok(layout.fits && layout.square && layout.visible && layout.size >= 216, `mobile ${width}x${height}: ${JSON.stringify(layout)}`);
    await page.mouse.wheel(0, 600);
    assert.equal(await page.evaluate(() => scrollY), 0, 'mobile page must not scroll');
  }
  await page.waitForFunction(() => document.getElementById('offline-status').textContent === 'Offline bereit');
  const saved = await read();
  await context.setOffline(true); await page.reload();
  await page.locator('.board-shell.ready').waitFor();
  assert.deepEqual((await read()).game.values, saved.game.values);
  await page.locator('#settings-open').click();
  await page.locator('#music-track').selectOption(tracks[0].value);
  await page.waitForFunction(() => { const audio = document.getElementById('reef-music'); return !audio.paused && audio.currentTime > 0.1; });
  const range = await page.evaluate(async () => {
    const response = await fetch(document.getElementById('reef-music').currentSrc, { headers:{ Range:'bytes=0-127' } });
    return { status:response.status, range:response.headers.get('Content-Range'), size:(await response.arrayBuffer()).byteLength };
  });
  assert.equal(range.status, 206); assert.equal(range.size, 128); assert.ok(range.range.startsWith('bytes 0-127/'));
  await page.locator('#reef-music').evaluate(audio => { audio.currentTime = 10; });
  await page.waitForFunction(() => { const audio = document.getElementById('reef-music'); return !audio.seeking && !audio.paused && audio.currentTime > 10.1; });
  await page.locator('#music-toggle').click();
  await page.locator('#settings-dialog .dialog-close').click();
  await page.locator('#new-game').click();
  await page.locator('#confirm-yes').click();
  await page.locator('#loading').waitFor({ state: 'hidden' });
  assert.notEqual((await read()).game.seed, saved.game.seed);
  assert.deepEqual(errors, [], `${name}: browser errors`);
  console.log(`${name}: input, notes, undo, save, win, achievements, second tab, languages, themes, 320px, offline generation and offline audio seeking passed.`);
  } finally { await browser.close(); }
}
