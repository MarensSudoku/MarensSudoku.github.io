import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { makeMusicTracks, pickMusicTrack, DEFAULT_MUSIC_TRACK } from '../web/music.mjs';
import { generate } from '../web/sudoku/engine.mjs';
import { createGame } from '../web/sudoku/model.mjs';
import { defaults, load, save, STORAGE_KEY } from '../web/storage.mjs';
import { parseByteRange, rangeResponse } from '../web/range.mjs';

test('dropped music files and numbered variants have distinct translated names', async () => {
  const tracks = makeMusicTracks(await readdir(new URL('../web/assets/music/', import.meta.url)));
  assert.ok(tracks.length > 0);
  assert.equal(tracks.some(track => track.file === '03-schwebende-perlen_2.mp3'), false);
  assert.equal(tracks[0].file, DEFAULT_MUSIC_TRACK);
  assert.equal(new Set(tracks.map(track => track.file)).size, tracks.length);
  for (const track of tracks) {
    assert.ok(track.de && track.en);
    assert.ok((await stat(new URL('../web/assets/music/' + track.file, import.meta.url))).size > 0);
  }
  const variants = makeMusicTracks(['01-sonnenlicht-ueber-dem-riff_1.mp3','01-sonnenlicht-ueber-dem-riff_2.mp3','README.md','../private.mp3']);
  assert.equal(variants.length, 2); assert.notEqual(variants[0].de, variants[1].de);
  assert.ok(variants[0].de.includes('Variante 1'));
  const nested = makeMusicTracks(['04-kristallklares-wasser_1.mp3','04-kristallklares-wasser_1_2.mp3']);
  assert.equal(nested.find(track => track.file === '04-kristallklares-wasser_1.mp3').de, 'Kristallklares Wasser · Variante 1');
  assert.equal(nested.find(track => track.file === '04-kristallklares-wasser_1_2.mp3').de, 'Kristallklares Wasser · Variante 2');
});
test('random music stays in the catalogue and never repeats the previous track when alternatives exist', () => {
  const tracks = makeMusicTracks(['a.mp3','b.mp3','c.mp3']);
  assert.equal(pickMusicTrack([], ''), '');
  assert.equal(pickMusicTrack([tracks[0]], tracks[0].file), tracks[0].file);
  let current = 'missing.mp3';
  for (let i = 0; i < 100; i++) {
    const next = pickMusicTrack(tracks, current);
    assert.ok(tracks.some(track => track.file === next));
    assert.notEqual(next, current); current = next;
  }
});

test('older game saves acquire music defaults without losing game or progress', () => {
  let stored;
  globalThis.localStorage = { getItem: key => key === STORAGE_KEY ? stored : null, setItem: (key, value) => { stored = value; } };
  const game = createGame(generate('easy', 42));
  const settings = { language:'de', theme:'light', reducedMotion:false, showConflicts:true, tracking:true };
  const progress = { total:1, easy:1, medium:0, hard:0, direct:1, unlocked:['first','direct'] };
  stored = JSON.stringify({ schema:1, game, settings, progress });
  const restored = load();
  assert.equal(restored.problem, false);
  assert.deepEqual(restored.game, game); assert.deepEqual(restored.progress, progress);
  assert.equal(restored.settings.musicVolume, 0.25);
  assert.equal(restored.settings.musicTrack, DEFAULT_MUSIC_TRACK);
  assert.equal(restored.settings.musicEnabled, true);
  assert.equal(restored.settings.sfxEnabled, true);
  restored.settings.musicVolume = 0.4; restored.settings.musicTrack = '04-kristallklares-wasser.mp3';
  assert.equal(save(restored.game, restored.settings, restored.progress), true);
  assert.equal(load().settings.musicVolume, 0.4);
  assert.equal(load().settings.musicTrack, '04-kristallklares-wasser.mp3');
});
test('reloading after a music pause re-enables playback without changing saved preferences or game', () => {
  let stored;
  globalThis.localStorage = { getItem: () => stored, setItem: (key, value) => { stored = value; } };
  const game = createGame(generate('easy', 43));
  const settings = { ...defaults(), musicEnabled:false, musicVolume:0.4, musicTrack:'03-schwebende-perlen_2.mp3' };
  assert.equal(save(game, settings, null), true);
  const restored = load();
  assert.equal(restored.settings.musicEnabled, true);
  assert.equal(restored.settings.musicVolume, 0.4);
  assert.equal(restored.settings.musicTrack, settings.musicTrack);
  assert.deepEqual(restored.game, game);
});

test('single byte ranges include open ends, suffixes and unsatisfiable requests', () => {
  assert.deepEqual(parseByteRange('bytes=0-15', 100), { start:0, end:15 });
  assert.deepEqual(parseByteRange('bytes=90-', 100), { start:90, end:99 });
  assert.deepEqual(parseByteRange('bytes=-10', 100), { start:90, end:99 });
  assert.deepEqual(parseByteRange('bytes=90-200', 100), { start:90, end:99 });
  assert.equal(parseByteRange('bytes=100-', 100), null);
  assert.equal(parseByteRange('bytes=20-10', 100), null);
  assert.equal(parseByteRange('bytes=-0', 100), null);
  assert.equal(parseByteRange('bytes=0-2,5-6', 100), undefined);
  assert.equal(parseByteRange('garbage', 100), undefined);
});
test('offline media returns correct bytes and headers for playback and seeking', async () => {
  const source = () => new Response(Uint8Array.from({ length:100 }, (_, i) => i), { headers:{ 'Content-Type':'audio/mpeg' } });
  const partial = await rangeResponse(source(), 'bytes=10-19');
  assert.equal(partial.status, 206); assert.equal(partial.headers.get('content-range'), 'bytes 10-19/100');
  assert.equal(partial.headers.get('content-length'), '10');
  assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [10,11,12,13,14,15,16,17,18,19]);
  assert.equal((await rangeResponse(source(), 'bytes=100-')).status, 416);
  const ignored = await rangeResponse(source(), 'invalid');
  assert.equal(ignored.status, 200); assert.equal((await ignored.arrayBuffer()).byteLength, 100);
});
