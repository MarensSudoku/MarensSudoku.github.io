import test from 'node:test';
import assert from 'node:assert/strict';
import { countSolutions, generate, isSolved, solveLogic } from '../web/sudoku/engine.mjs';
import { createGame, enter, undo, complete, emptyProgress, emptyScores, validGame } from '../web/sudoku/model.mjs';
const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number);
const solution = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'.split('').map(Number);
test('solver distinguishes impossible, unique and multiple solutions', () => {
  assert.equal(countSolutions(puzzle), 1);
  assert.equal(countSolutions(Array(81).fill(0)), 2);
  const impossible = [...puzzle]; impossible[2] = 5;
  assert.equal(countSolutions(impossible), 0);
  assert.equal(isSolved(impossible), false);
  assert.deepEqual(solveLogic(puzzle).solution, solution);
});
for (const difficulty of ['easy','medium','hard']) test(`generator: ${difficulty}, uniqueness, logic and reproducibility`, () => {
  for (let seed = 1; seed <= 5; seed++) {
    const result = generate(difficulty, seed);
    assert.equal(countSolutions(result.puzzle), 1);
    assert.equal(isSolved(result.solution), true);
    assert.equal(solveLogic(result.puzzle).solved, true);
    assert.equal(result.puzzle.every((n, i) => !n || n === result.solution[i]), true);
    assert.ok(difficulty === 'easy' ? result.rank === 0 : difficulty === 'medium' ? [1, 2].includes(result.rank) : result.rank === 3);
    assert.deepEqual(generate(difficulty, seed), result);
  }
});
test('notes, peer cleanup and complete undo preserve givens', () => {
  const game = createGame({ puzzle, solution, difficulty: 'easy', seed: 1, version: 1 });
  assert.equal(enter(game, 0, 9), false);
  assert.equal(enter(game, 2, 4, true), true);
  assert.equal(game.notes[2], 1 << 4);
  enter(game, 3, 4);
  assert.equal(game.notes[2], 0);
  undo(game);
  assert.equal(game.notes[2], 1 << 4);
  assert.equal(game.values[3], 0);
  assert.equal(game.usedUndo, true);
  assert.equal(validGame(game), true);
});
test('achievements credit one round once, including after undo and reload', () => {
  const game = createGame({ puzzle, solution, difficulty: 'hard', seed: 1, version: 1 });
  const progress = emptyProgress(), scores = emptyScores();
  game.values = [...solution];
  assert.equal(complete(game, progress, true, scores).length, 2);
  assert.equal(progress.total, 1);
  assert.deepEqual(complete(JSON.parse(JSON.stringify(game)), progress, true, scores), []);
  assert.equal(progress.total, 1);
  const disabled = createGame({ puzzle, solution, difficulty: 'easy', seed: 1, version: 1 });
  disabled.values = [...solution];
  complete(disabled, progress, false, scores);
  assert.equal(progress.total, 1);
});
test('storage validation rejects changed givens, invalid notes and malformed histories', () => {
  const game = createGame({ puzzle, solution, difficulty: 'easy', seed: 1, version: 1 });
  assert.equal(validGame(game), true);
  game.values[0] = 8; assert.equal(validGame(game), false);
  game.values[0] = 5; game.notes[2] = 0x400; assert.equal(validGame(game), false);
  game.notes[2] = 0; game.history = [{}]; assert.equal(validGame(game), false);
});
