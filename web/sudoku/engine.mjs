export const GENERATOR_VERSION = 1;
export const UNITS = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, n) =>
    (Math.floor(b / 3) * 3 + Math.floor(n / 3)) * 9 + (b % 3) * 3 + n % 3)),
];
export const PEERS = Array.from({ length: 81 }, (_, i) =>
  [...new Set(UNITS.filter(unit => unit.includes(i)).flat())].filter(j => j !== i));
const ALL = 0x3fe;
const bits = mask => { let n = 0; for (; mask; mask &= mask - 1) n++; return n; };
const digit = bit => Math.log2(bit);
export const validGrid = grid => Array.isArray(grid) && grid.length === 81 &&
  grid.every(n => Number.isInteger(n) && n >= 0 && n <= 9);
export function conflicts(grid) {
  const result = new Set();
  for (const unit of UNITS) for (const i of unit) {
    if (grid[i] && unit.some(j => j !== i && grid[j] === grid[i])) result.add(i);
  }
  return result;
}
export const isSolved = grid => validGrid(grid) && grid.every(Boolean) && conflicts(grid).size === 0;
const candidates = grid => grid.map((n, i) => n ? 0 : PEERS[i].reduce((m, j) => m & ~(1 << grid[j]), ALL));

export function countSolutions(input, limit = 2, budget = 200000) {
  if (!validGrid(input) || conflicts(input).size) return 0;
  const grid = [...input];
  let count = 0;
  function visit() {
    if (--budget < 0) throw new Error('Search budget exceeded');
    let best = -1, mask = 0, size = 10;
    for (let i = 0; i < 81; i++) if (!grid[i]) {
      const possible = PEERS[i].reduce((m, j) => m & ~(1 << grid[j]), ALL);
      const n = bits(possible);
      if (!n) return;
      if (n < size) { best = i; mask = possible; size = n; if (n === 1) break; }
    }
    if (best < 0) { count++; return; }
    for (let options = mask; options && count < limit; options &= options - 1) {
      grid[best] = digit(options & -options);
      visit();
    }
    grid[best] = 0;
  }
  visit();
  return count;
}

export function solveLogic(input) {
  if (!validGrid(input) || conflicts(input).size) return { solved: false, rank: -1 };
  const grid = [...input];
  let masks = candidates(grid), rank = 0;
  const place = (i, bit) => { grid[i] = digit(bit); masks = candidates(grid); };
  for (let pass = 0; pass < 1200; pass++) {
    if (grid.every(Boolean)) return { solved: isSolved(grid), rank, solution: grid };
    if (grid.some((v, i) => !v && !masks[i])) return { solved: false, rank };
    const single = masks.findIndex(m => bits(m) === 1);
    if (single >= 0) { place(single, masks[single]); continue; }
    let changed = false;
    outer: for (const unit of UNITS) for (let n = 1; n <= 9; n++) {
      const places = unit.filter(i => masks[i] & (1 << n));
      if (places.length === 1) { place(places[0], 1 << n); rank = Math.max(rank, 1); changed = true; break outer; }
    }
    if (changed) continue;
    outer: for (const unit of UNITS) for (let n = 1; n <= 9; n++) {
      const bit = 1 << n, places = unit.filter(i => masks[i] & bit);
      if (places.length < 2) continue;
      for (const other of UNITS) {
        if (other === unit || !places.every(i => other.includes(i))) continue;
        const targets = other.filter(i => !unit.includes(i) && (masks[i] & bit));
        if (targets.length) { targets.forEach(i => { masks[i] &= ~bit; }); rank = Math.max(rank, 2); changed = true; break outer; }
      }
    }
    if (changed) continue;
    outer: for (const unit of UNITS) for (const i of unit) {
      const pair = masks[i];
      if (bits(pair) !== 2 || unit.filter(j => masks[j] === pair).length !== 2) continue;
      const targets = unit.filter(j => masks[j] && masks[j] !== pair && (masks[j] & pair));
      if (targets.length) { targets.forEach(j => { masks[j] &= ~pair; }); rank = Math.max(rank, 3); changed = true; break outer; }
    }
    if (!changed) return { solved: false, rank };
  }
  return { solved: false, rank };
}

function randomSource(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function solutionGrid(random) {
  const grid = Array(81).fill(0);
  function fill() {
    let best = -1, choices = [], length = 10;
    for (let i = 0; i < 81; i++) if (!grid[i]) {
      const options = [1,2,3,4,5,6,7,8,9].filter(n => !PEERS[i].some(j => grid[j] === n));
      if (!options.length) return false;
      if (options.length < length) { best = i; choices = options; length = options.length; if (length === 1) break; }
    }
    if (best < 0) return true;
    for (const n of shuffled(choices, random)) { grid[best] = n; if (fill()) return true; }
    grid[best] = 0;
    return false;
  }
  fill();
  return grid;
}
export function generate(difficulty = 'easy', seed = 1) {
  const limits = { easy: { max: 0, min: 0, clues: 39 }, medium: { max: 2, min: 1, clues: 31 }, hard: { max: 3, min: 3, clues: 26 } };
  const setting = limits[difficulty];
  if (!setting || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid generator parameters');
  const random = randomSource(seed);
  for (let attempt = 0; attempt < 80; attempt++) {
    const solution = solutionGrid(random), puzzle = [...solution];
    let best = null;
    for (const i of shuffled(Array.from({ length: 81 }, (_, n) => n), random)) {
      const value = puzzle[i]; puzzle[i] = 0;
      let unique;
      try { unique = countSolutions(puzzle) === 1; } catch { unique = false; }
      if (!unique) { puzzle[i] = value; continue; }
      const rating = solveLogic(puzzle);
      if (!rating.solved || rating.rank > setting.max) { puzzle[i] = value; continue; }
      if (rating.rank >= setting.min) best = { puzzle: [...puzzle], solution, rank: rating.rank, seed, difficulty, version: GENERATOR_VERSION };
      if (best && puzzle.filter(Boolean).length <= setting.clues) return best;
    }
    if (best && best.puzzle.filter(Boolean).length < 45) return best;
  }
  throw new Error('No matching puzzle within generation budget');
}
