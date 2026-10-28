import { isSolved, PEERS, UNITS, validGrid } from './engine.mjs';
export function createGame(puzzle) {
  return { ...puzzle, values: [...puzzle.puzzle], notes: Array(81).fill(0), history: [], usedUndo: false, completionRecorded: false };
}
export function enter(game, index, number, note = false) {
  if (!Number.isInteger(index) || index < 0 || index > 80 || !Number.isInteger(number) || number < 0 || number > 9 || game.puzzle[index]) return false;
  if (note && (game.values[index] || !number)) return false;
  if (!note && game.values[index] === number && (number || !game.notes[index])) return false;
  game.history.push({ values: [...game.values], notes: [...game.notes] });
  if (game.history.length > 100) game.history.shift();
  if (note) game.notes[index] ^= 1 << number;
  else {
    game.values[index] = number; game.notes[index] = 0;
    if (number) for (const peer of PEERS[index]) game.notes[peer] &= ~(1 << number);
  }
  return true;
}
export function undo(game) {
  const previous = game.history.pop();
  if (!previous) return false;
  game.values = previous.values; game.notes = previous.notes; game.usedUndo = true;
  return true;
}
export const fullUnits = game => UNITS.map((unit, n) => unit.every(i => game.values[i]) && new Set(unit.map(i => game.values[i])).size === 9 ? n : -1).filter(n => n >= 0);
export const ACHIEVEMENTS = [
  { id: 'first', name: 'Erste Perle', en: 'First pearl', target: 1, kind: 'total', icon: 'shell' },
  { id: 'flow', name: 'Riffentdeckerin', en: 'Reef explorer', target: 10, kind: 'total', icon: 'fish' },
  { id: 'magic', name: 'Korallengarten', en: 'Coral garden', target: 50, kind: 'total', icon: 'coral' },
  { id: 'stars', name: 'Perlenschatz', en: 'Pearl treasure', target: 100, kind: 'total', icon: 'pearl' },
  { id: 'variety', name: 'Bunte Unterwasserwelt', en: 'Reef rainbow', target: 3, kind: 'variety', icon: 'fish' },
  { id: 'crown', name: 'Riffkrone', en: 'Reef crown', target: 5, kind: 'hard', icon: 'crown' },
  { id: 'direct', name: 'Klarer Kurs', en: 'Clear course', target: 1, kind: 'direct', icon: 'star' },
];
export const emptyProgress = () => ({ total: 0, easy: 0, medium: 0, hard: 0, direct: 0, unlocked: [] });
export function progressValue(progress, achievement) {
  return achievement.kind === 'variety' ? ['easy','medium','hard'].filter(key => progress[key] > 0).length : progress[achievement.kind];
}
export function complete(game, progress, tracking) {
  if (game.completionRecorded || !isSolved(game.values)) return [];
  game.completionRecorded = true;
  if (!tracking) return [];
  progress.total++; progress[game.difficulty]++;
  if (!game.usedUndo) progress.direct++;
  const fresh = ACHIEVEMENTS.filter(a => !progress.unlocked.includes(a.id) && progressValue(progress, a) >= a.target);
  progress.unlocked.push(...fresh.map(a => a.id));
  return fresh;
}
export function validGame(game) {
  if (!game || !validGrid(game.puzzle) || !validGrid(game.values) || !isSolved(game.solution)) return false;
  if (!['easy','medium','hard'].includes(game.difficulty) || game.version !== 1 || !Number.isInteger(game.seed)) return false;
  if (game.puzzle.some((n, i) => n && (game.solution[i] !== n || game.values[i] !== n))) return false;
  if (!Array.isArray(game.notes) || game.notes.length !== 81 || !game.notes.every(n => Number.isInteger(n) && n >= 0 && !(n & ~0x3fe))) return false;
  if (!Array.isArray(game.history) || game.history.length > 100 || !game.history.every(h => validGrid(h.values) && game.puzzle.every((n, i) => !n || h.values[i] === n) && Array.isArray(h.notes) && h.notes.length === 81 && h.notes.every(n => Number.isInteger(n) && n >= 0 && !(n & ~0x3fe)))) return false;
  return typeof game.usedUndo === 'boolean' && typeof game.completionRecorded === 'boolean';
}
