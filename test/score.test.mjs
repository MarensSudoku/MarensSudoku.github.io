import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../web/sudoku/engine.mjs';
import { createGame, enter, undo, complete, emptyProgress, scoreRound, validGame } from '../web/sudoku/model.mjs';
import { defaults, load, save } from '../web/storage.mjs';

test('round points reward difficulty, active time, accuracy and every fifth puzzle', () => {
  const game = createGame(generate('easy', 42));
  assert.deepEqual(scoreRound(game), { base:1000, time:500, clean:200, direct:100, milestone:0, total:1800 });
  game.elapsedMs = 300000;
  assert.equal(scoreRound(game).time, 250);
  game.elapsedMs = 900000;
  assert.equal(scoreRound(game).time, 0);
  game.elapsedMs = 0; game.difficulty = 'medium';
  assert.equal(scoreRound(game).total, 3600);
  game.difficulty = 'hard';
  assert.equal(scoreRound(game, 5).total, 5900);
  game.mistakes = 1; game.usedUndo = true;
  assert.equal(scoreRound(game).total, 4500);
});

test('notes and rejected input do not count as mistakes; undo cannot restore a clean bonus', () => {
  const game = createGame(generate('easy', 43)), index = game.puzzle.findIndex(n => !n);
  const wrong = game.solution[index] % 9 + 1;
  enter(game, index, wrong, true); assert.equal(game.mistakes, 0);
  enter(game, index, wrong); assert.equal(game.mistakes, 1);
  enter(game, index, wrong); assert.equal(game.mistakes, 1);
  undo(game); assert.equal(game.mistakes, 1);
  assert.equal(scoreRound(game).clean, 0); assert.equal(scoreRound(game).direct, 0);
});

test('only a solved round awards points once; optional saving and reset include all score totals', () => {
  const game = createGame(generate('easy', 44)), progress = emptyProgress();
  complete(game, progress, true); assert.equal(progress.points, 0); assert.equal(game.score, null);
  game.values = [...game.solution]; complete(game, progress, true);
  assert.equal(progress.points, 1800); assert.equal(progress.best, 1800); assert.equal(progress.total, 1);
  complete(JSON.parse(JSON.stringify(game)), progress, true); assert.equal(progress.points, 1800);
  const unsaved = createGame(generate('easy', 45)); unsaved.values = [...unsaved.solution];
  complete(unsaved, progress, false); assert.equal(unsaved.score.total, 1800); assert.equal(progress.points, 1800);
  assert.equal(emptyProgress().points, 0); assert.equal(emptyProgress().best, 0);
  assert.equal(validGame(game), true); game.score.total++; assert.equal(validGame(game), false);
});

test('old saves gain score fields without losing the puzzle or existing achievement counts', () => {
  let stored;
  globalThis.localStorage = { getItem:() => stored, setItem:(key,value) => { stored = value; } };
  const game = createGame(generate('easy', 46)); delete game.elapsedMs; delete game.mistakes; delete game.score;
  const progress = { total:4, easy:4, medium:0, hard:0, direct:0, unlocked:['first'] };
  save(game, { ...defaults(), tracking:true }, progress);
  const restored = load(); assert.equal(restored.problem, false);
  assert.deepEqual(restored.game.values, game.values); assert.equal(restored.game.elapsedMs, 0);
  assert.equal(restored.progress.total, 4); assert.equal(restored.progress.points, 0);
  restored.game.values = [...restored.game.solution]; complete(restored.game, restored.progress, true);
  assert.equal(restored.game.score.milestone, 500); assert.equal(restored.progress.total, 5);
  save(restored.game, restored.settings, { ...restored.progress, points:1, best:2 });
  const invalid = stored; assert.equal(load().problem, true); assert.equal(stored, invalid);
  restored.game.elapsedMs = -1; assert.equal(validGame(restored.game), false);
});
