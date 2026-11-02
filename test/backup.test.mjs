import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, readBackup, restoreBackup, MAX_BACKUP_BYTES } from '../web/backup.mjs';
import { defaults, save, load, STORAGE_KEY } from '../web/storage.mjs';
import { reefObject, REEF_STORAGE_KEY } from '../web/reef-layout.mjs';
import { createGame, emptyProgress, emptyScores, enter } from '../web/sudoku/model.mjs';
import { generate } from '../web/sudoku/engine.mjs';
const memory = () => {
  const data = new Map();
  return { getItem:key=>data.get(key) ?? null, setItem:(key,value)=>data.set(key,value), removeItem:key=>data.delete(key) };
};
function fixture() {
  globalThis.localStorage = memory();
  const game = createGame(generate('medium', 62)), index = game.values.findIndex(n=>!n);
  enter(game, index, game.solution[index], true);
  game.elapsedMs = 12000;
  save(game, { ...defaults(), rememberMusic:true, musicEnabled:false, musicMuted:true, energySaver:true }, emptyProgress(), emptyScores());
  localStorage.setItem(REEF_STORAGE_KEY, JSON.stringify({schema:1,objects:[reefObject('clownfish','my-fish',{hue:70,pitch:.3})]}));
  return { game, text:makeBackup() };
}
test('backup restores game, notes, history, points, preferences and the complete reef on another device', () => {
  const { game, text } = fixture(), backup = readBackup(text), destination = memory();
  assert.equal(restoreBackup(backup,destination), true);
  globalThis.localStorage = destination;
  const restored = load();
  assert.deepEqual(restored.game,game);
  assert.equal(restored.settings.energySaver,true); assert.equal(restored.settings.musicEnabled,false); assert.equal(restored.settings.musicMuted,true);
  assert.deepEqual(JSON.parse(localStorage.getItem(REEF_STORAGE_KEY)),backup.reef);
  assert.deepEqual(readBackup(makeBackup()),backup);
});
test('malformed, oversized and non-unique backups are rejected before touching current data', () => {
  const { text } = fixture(), before = localStorage.getItem(STORAGE_KEY);
  for (const invalid of ['{}','null','[', 'x'.repeat(MAX_BACKUP_BYTES + 1)]) assert.throws(()=>readBackup(invalid));
  for (const mutate of [
    data=>data.state.game.puzzle.fill(0),
    data=>data.state.game.values[0]=10,
    data=>data.state.scores.points=-1,
    data=>data.reef.objects[0].type='external.glb',
    data=>data.state.settings.language='unknown',
  ]) { const data=JSON.parse(text); mutate(data); assert.throws(()=>readBackup(JSON.stringify(data))); }
  assert.equal(localStorage.getItem(STORAGE_KEY),before);
});
test('a failed second storage write restores the original reef and keeps the original game', () => {
  const { text } = fixture(), backup = readBackup(text), destination = memory();
  destination.setItem(STORAGE_KEY,'old game'); destination.setItem(REEF_STORAGE_KEY,'old reef');
  const set = destination.setItem;
  destination.setItem = (key,value)=>{ if (key===STORAGE_KEY) throw new Error('Quota'); return set(key,value); };
  assert.equal(restoreBackup(backup,destination),false);
  assert.equal(destination.getItem(STORAGE_KEY),'old game'); assert.equal(destination.getItem(REEF_STORAGE_KEY),'old reef');
});
test('default and empty reefs remain distinct; disabled achievements stay disabled', () => {
  fixture();
  localStorage.removeItem(REEF_STORAGE_KEY);
  const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));raw.settings.tracking=false;raw.progress=null;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(raw));
  const backup=readBackup(makeBackup()), destination=memory();
  destination.setItem(REEF_STORAGE_KEY,'old reef');restoreBackup(backup,destination);
  assert.equal(destination.getItem(REEF_STORAGE_KEY),null);assert.equal(backup.state.progress,null);
  backup.reef={schema:1,objects:[]};restoreBackup(backup,destination);
  assert.deepEqual(JSON.parse(destination.getItem(REEF_STORAGE_KEY)),{schema:1,objects:[]});
});
