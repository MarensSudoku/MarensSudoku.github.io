import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { LOCALES, resolveLanguage } from '../web/locales.mjs';
import { RELEASE } from '../web/release.mjs';
import { ACHIEVEMENTS } from '../web/sudoku/model.mjs';
import { REEF_TYPES } from '../web/reef-layout.mjs';
import { makeMusicTracks, trackName } from '../web/music.mjs';
import { load, STORAGE_KEY } from '../web/storage.mjs';

const strings = async code => ({ ui:(await import(`../web/i18n/${code}.mjs`)).default, legal:(await import(`../web/i18n/${code}-legal.mjs`)).default });
const placeholders = value => (JSON.stringify(value).match(/\{[a-z]+\}/g) || []).sort();
const LEGAL = { imprint:'de', privacy:'de', code:'en', notices:'en', music:'de', sounds:'de', commons:'en' };

test('every language has every text, placeholder, flag, release note and legal reading aid', async () => {
  const reference = (await strings('de')).ui;
  for (const key of [...ACHIEVEMENTS.map(a => 'badge.' + a.id), ...REEF_TYPES.map(type => 'obj.' + type)]) assert.ok(reference[key], key);
  for (const [code, locale] of Object.entries(LOCALES)) {
    const { ui, legal } = await strings(code);
    assert.deepEqual(Object.keys(ui).sort(), Object.keys(reference).sort(), `${code}: keys`);
    for (const [key, value] of Object.entries(reference)) {
      assert.equal(typeof ui[key], typeof value, `${code}.${key}: type`);
      if (Array.isArray(value)) assert.equal(ui[key].length, value.length, `${code}.${key}: steps`);
      assert.ok(String(ui[key]).trim(), `${code}.${key}: empty`);
      assert.deepEqual(placeholders(ui[key]), placeholders(value), `${code}.${key}: placeholders`);
      if (/<[a-z]/.test(value)) assert.deepEqual(ui[key].match(/<\/?[a-z0-9]+/g), value.match(/<\/?[a-z0-9]+/g), `${code}.${key}: markup`);
    }
    assert.deepEqual(Object.keys(legal).sort(), Object.keys(LEGAL).filter(id => LEGAL[id] !== code).sort(), `${code}: legal reading aids`);
    for (const [id, copy] of Object.entries(legal)) assert.ok(Buffer.byteLength(copy) > 400, `${code}.${id}: legal text`);
    assert.equal(RELEASE.notes[code]?.length, RELEASE.notes.de.length, `${code}: release notes`);
    await access(new URL(`../web/assets/flags/flag-${locale.flag}.svg`, import.meta.url));
  }
});

test('browser languages pick the closest version with English as fallback', () => {
  for (const [preferences, expected] of [
    [['de-AT'], 'de'], [['es-MX'], 'es'], [['es-419'], 'es'], [['pt-BR'], 'pt-BR'], [['pt-PT'], 'pt'], [['pt'], 'pt'],
    [['zh-TW'], 'zh-Hant'], [['zh-HK'], 'zh-Hant'], [['zh-CN'], 'zh-Hans'], [['zh-Hant-TW'], 'zh-Hant'], [['zh'], 'zh-Hans'],
    [['iw-IL'], 'he'], [['in-ID'], 'id'], [['hi-IN'], 'hi'], [['vi'], 'vi'], [['tr-TR'], 'tr'],
    [['xx', 'nb-NO', 'fr-CA'], 'fr'], [['xx'], 'en'], [[], 'en'], [[undefined, 'ja'], 'ja'],
  ]) assert.equal(resolveLanguage(preferences), Object.hasOwn(LOCALES, expected) ? expected : 'en', preferences.join());
});

test('saved games keep published German and English and accept every new language', () => {
  let stored;
  globalThis.localStorage = { getItem: key => key === STORAGE_KEY ? stored : null, setItem() {} };
  const settings = language => ({ language, theme:'light', reducedMotion:false, showConflicts:true, tracking:false });
  for (const language of [...Object.keys(LOCALES)]) {
    stored = JSON.stringify({ schema:1, game:null, settings:settings(language), progress:null });
    assert.equal(load().problem, false, language); assert.equal(load().settings.language, language);
  }
  stored = JSON.stringify({ schema:1, game:null, settings:settings('xx'), progress:null });
  assert.equal(load().problem, true);
});

test('music titles come from the language files and keep readable fallbacks', async () => {
  const { ui } = await strings('fr'), t = key => ui[key] ?? key;
  const [first, second] = makeMusicTracks(['01-sonnenlicht-ueber-dem-riff_1.mp3', '07-neuer-titel.mp3']);
  assert.equal(trackName(first, t), `${ui['track.01-sonnenlicht-ueber-dem-riff']} · ${ui.musicVariant.replace('{n}', '1')}`);
  assert.equal(trackName(second, t), 'neuer titel');
});
