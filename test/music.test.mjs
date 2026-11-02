import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { makeMusicTracks, pickMusicTrack, trackName, DEFAULT_MUSIC_TRACK } from '../web/music.mjs';
import de from '../web/i18n/de.mjs';
const name = track => trackName(track, key => de[key] ?? key);
import { generate } from '../web/sudoku/engine.mjs';
import { createGame, emptyProgress } from '../web/sudoku/model.mjs';
import { defaults, load, save, STORAGE_KEY } from '../web/storage.mjs';
import { parseByteRange, rangeResponse } from '../web/range.mjs';

test('all twenty music recordings have consecutive numbers and distinct translated titles', async () => {
  const tracks = makeMusicTracks(await readdir(new URL('../web/assets/music/', import.meta.url)));
  assert.equal(tracks.length,20);
  assert.equal(tracks.some(track => track.file === '03-schwebende-perlen_2.mp3'), false);
  assert.equal(tracks[2].file, DEFAULT_MUSIC_TRACK);
  assert.equal(new Set(tracks.map(track => track.file)).size, tracks.length);
  assert.equal(new Set(tracks.map(track=>name(track))).size,tracks.length);
  assert.deepEqual(tracks.map(track=>Number(track.file.slice(0,2))),Array.from({length:20},(_,index)=>index+1));
  for (const track of tracks) {
    assert.ok(de[track.key], track.key);
    assert.ok(!track.file.includes('_')&&!name(track).includes('Variante'));
    assert.ok((await stat(new URL('../web/assets/music/' + track.file, import.meta.url))).size > 0);
  }
  const dropped=makeMusicTracks(['21-neuer-titel.mp3','README.md','../private.mp3']);
  assert.equal(dropped.length,1);assert.equal(name(dropped[0]),'21 · neuer titel');
});

test('published music names migrate while favourites are validated and saved without changing the game',()=>{
  let stored;
  globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};
  const game=createGame(generate('easy',44)),settings={...defaults(),musicTrack:'01-sonnenlicht-ueber-dem-riff_2.mp3',musicFavorites:['12-sonnentanz-in-der-lagune.mp3','12-sonnentanz-in-der-lagune.mp3','../private.mp3',null],musicFavoritesOnly:true};
  save(game,settings,emptyProgress());
  const restored=load();
  assert.equal(restored.problem,false);assert.deepEqual(restored.game,game);
  assert.equal(restored.settings.musicTrack,'02-goldene-strahlen.mp3');
  assert.deepEqual(restored.settings.musicFavorites,['12-sonnentanz-in-der-lagune.mp3']);
  assert.equal(restored.settings.musicFavoritesOnly,true);
  save(restored.game,restored.settings,restored.progress);
  assert.deepEqual(load().settings.musicFavorites,restored.settings.musicFavorites);
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

test('ordered music follows the catalogue and wraps around', () => {
  const tracks = makeMusicTracks(['a.mp3','b.mp3','c.mp3']);
  assert.equal(pickMusicTrack(tracks, 'a.mp3', 'sequential'), 'b.mp3');
  assert.equal(pickMusicTrack(tracks, 'c.mp3', 'sequential'), 'a.mp3');
  assert.equal(pickMusicTrack(tracks, 'missing.mp3', 'sequential'), 'a.mp3');
  assert.equal(pickMusicTrack([], '', 'sequential'), '');
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
  assert.equal(save(game, settings, emptyProgress()), true);
  const restored = load();
  assert.equal(restored.settings.musicEnabled, true);
  assert.equal(restored.settings.musicVolume, 0.4);
  assert.equal(restored.settings.musicTrack, settings.musicTrack);
  assert.deepEqual(restored.game, game);
});

test('optional remembered pause and mute survive reload while preserving the game', () => {
  let stored;
  globalThis.localStorage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};
  const game=createGame(generate('easy',45));
  save(game,{...defaults(),rememberMusic:true,musicEnabled:false,musicMuted:true,energySaver:true},emptyProgress());
  const restored=load();
  assert.equal(restored.settings.musicEnabled,false);assert.equal(restored.settings.musicMuted,true);
  assert.equal(restored.settings.energySaver,true);assert.deepEqual(restored.game,game);
  restored.settings.rememberMusic=false;save(game,restored.settings,restored.progress);
  assert.equal(load().settings.musicEnabled,true);assert.equal(load().settings.musicMuted,false);
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
