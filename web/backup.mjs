import { parseState, STORAGE_KEY } from './storage.mjs';
import { REEF_STORAGE_KEY, validReefLayout } from './reef-layout.mjs';
import { countSolutions } from './sudoku/engine.mjs';

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export function readBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('Invalid backup size');
  const backup = JSON.parse(text);
  if (backup?.app !== 'MarensSudoku' || backup.schema !== 1 || !backup.state ||
      !(backup.reef === null || validReefLayout(backup.reef))) throw new Error('Invalid backup');
  const state = parseState(JSON.stringify(backup.state));
  if (state.problem || state.game && countSolutions(state.game.puzzle) !== 1) throw new Error('Invalid saved game');
  return { state:{ schema:1, game:state.game, settings:state.settings, progress:state.settings.tracking ? state.progress : null, scores:state.scores }, reef:backup.reef };
}
export function makeBackup(storage = localStorage) {
  const text = JSON.stringify({ app:'MarensSudoku', schema:1, state:JSON.parse(storage.getItem(STORAGE_KEY)), reef:JSON.parse(storage.getItem(REEF_STORAGE_KEY)) });
  readBackup(text);
  return text;
}
export function restoreBackup(backup, storage = localStorage) {
  const entries = [[REEF_STORAGE_KEY, backup.reef === null ? null : JSON.stringify(backup.reef)], [STORAGE_KEY, JSON.stringify(backup.state)]];
  const previous = entries.map(([key]) => [key, storage.getItem(key)]);
  const write = ([key, value]) => value === null ? storage.removeItem(key) : storage.setItem(key, value);
  let written = 0;
  try { for (const entry of entries) { write(entry); written++; } return true; }
  catch { previous.slice(0, written).reverse().forEach(write); return false; }
}
