import { isSolved, PEERS, UNITS, validGrid } from './engine.mjs';
export function createGame(puzzle) {
  return { ...puzzle, values: [...puzzle.puzzle], notes: Array(81).fill(0), history: [], usedUndo: false, completionRecorded: false, elapsedMs:0, mistakes:0, score:null };
}
const BASE_POINTS = { easy:1000, medium:2000, hard:3000 };
const TARGET_TIME = { easy:600000, medium:1200000, hard:2400000 };
export function scoreRound(game, roundNumber = 1) {
  const base = BASE_POINTS[game.difficulty];
  const time = Math.max(0, Math.round(base / 2 * (1 - game.elapsedMs / TARGET_TIME[game.difficulty])));
  const clean = game.mistakes === 0 ? base / 5 : 0, direct = game.usedUndo ? 0 : base / 10;
  const milestone = roundNumber > 0 && roundNumber % 5 === 0 ? 500 : 0;
  return { base, time, clean, direct, milestone, total:base + time + clean + direct + milestone };
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
    if (number && number !== game.solution[index]) game.mistakes = Math.min(Number.MAX_SAFE_INTEGER, game.mistakes + 1);
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
export const emptyProgress = () => ({ total: 0, easy: 0, medium: 0, hard: 0, direct: 0, unlocked: [], points:0, best:0 });
export function progressValue(progress, achievement) {
  return achievement.kind === 'variety' ? ['easy','medium','hard'].filter(key => progress[key] > 0).length : progress[achievement.kind];
}
export function complete(game, progress, tracking) {
  if (game.completionRecorded || !isSolved(game.values)) return [];
  game.score = scoreRound(game, tracking ? progress.total + 1 : 1);
  game.completionRecorded = true;
  if (!tracking) return [];
  progress.total++; progress[game.difficulty]++;
  progress.points = Math.min(Number.MAX_SAFE_INTEGER, progress.points + game.score.total);
  progress.best = Math.max(progress.best, game.score.total);
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
  if (!['elapsedMs','mistakes'].every(key => game[key] === undefined || Number.isSafeInteger(game[key]) && game[key] >= 0)) return false;
  if (game.score != null) {
    const score = game.score, base = BASE_POINTS[game.difficulty];
    if (!game.completionRecorded || !['base','time','clean','direct','milestone','total'].every(key => Number.isSafeInteger(score[key]) && score[key] >= 0) ||
      score.base !== base || score.time > base / 2 || ![0,base / 5].includes(score.clean) || ![0,base / 10].includes(score.direct) || ![0,500].includes(score.milestone) ||
      score.total !== score.base + score.time + score.clean + score.direct + score.milestone) return false;
  }
  return typeof game.usedUndo === 'boolean' && typeof game.completionRecorded === 'boolean';
}
