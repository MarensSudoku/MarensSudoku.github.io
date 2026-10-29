import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../web/sudoku/engine.mjs';
import { createGame, restartGame, enter, undo, complete, emptyProgress, emptyScores, scoreRound, validGame } from '../web/sudoku/model.mjs';
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

test('only a solved round awards points once, including without optional achievements', () => {
  const game = createGame(generate('easy', 44)), progress = emptyProgress(), scores = emptyScores();
  complete(game, progress, true, scores); assert.equal(scores.points, 0); assert.equal(game.score, null);
  game.values = [...game.solution]; complete(game, progress, true, scores);
  assert.equal(scores.points, 1800); assert.equal(scores.best, 1800); assert.equal(progress.total, 1);
  complete(JSON.parse(JSON.stringify(game)), progress, true, scores); assert.equal(scores.points, 1800);
  const unsaved = createGame(generate('easy', 45)); unsaved.values = [...unsaved.solution];
  complete(unsaved, progress, false, scores); assert.equal(unsaved.score.total, 1800); assert.equal(scores.points, 3600); assert.equal(scores.solved,2); assert.equal(progress.total,1);
  assert.equal(emptyScores().points, 0); assert.equal(emptyScores().best, 0);
  assert.equal(validGame(game), true); game.score.total++; assert.equal(validGame(game), false);
});

test('old saves gain score fields without losing the puzzle or existing achievement counts', () => {
  let stored;
  globalThis.localStorage = { getItem:() => stored, setItem:(key,value) => { stored = value; } };
  const game = createGame(generate('easy', 46)); delete game.elapsedMs; delete game.mistakes; delete game.score; delete game.credited;
  const progress = { total:4, easy:4, medium:0, hard:0, direct:0, unlocked:['first'] };
  save(game, { ...defaults(), tracking:true }, progress);
  const restored = load(); assert.equal(restored.problem, false);
  assert.deepEqual(restored.game.values, game.values); assert.equal(restored.game.elapsedMs, 0);
  assert.equal(restored.progress.total, 4); assert.equal(restored.scores.points, 0);
  restored.game.values = [...restored.game.solution]; complete(restored.game, restored.progress, true, restored.scores);
  assert.equal(restored.game.score.milestone, 500); assert.equal(restored.progress.total, 5);
  save(restored.game, restored.settings, restored.progress, { ...restored.scores, points:1, best:2 });
  const invalid = stored; assert.equal(load().problem, true); assert.equal(stored, invalid);
  restored.game.elapsedMs = -1; assert.equal(validGame(restored.game), false);
});

test('points survive reload and a new puzzle with achievement saving disabled', () => {
  let stored;
  globalThis.localStorage = { getItem:()=>stored, setItem:(key,value)=>{stored=value;} };
  const game=createGame(generate('easy',47)), progress=emptyProgress(), scores=emptyScores(), settings={...defaults(),tracking:false};
  game.values=[...game.solution]; complete(game,progress,false,scores);
  save(game,settings,progress,scores);
  let restored=load(); assert.equal(restored.problem,false); assert.equal(restored.scores.points,1800); assert.equal(restored.scores.solved,1); assert.equal(restored.progress.total,0);
  save(createGame(generate('easy',48)),settings,progress,restored.scores);
  restored=load(); assert.equal(restored.scores.points,1800);
  save(game,settings,progress,emptyScores()); assert.equal(load().scores.points,0,'cleared totals must not be recovered again from the round');
});

test('a previously saved round result is recovered once when old totals are missing', () => {
  let stored;
  globalThis.localStorage = { getItem:()=>stored, setItem:(key,value)=>{stored=value;} };
  const game=createGame(generate('easy',49)), progress=emptyProgress(), scores=emptyScores(), settings=defaults();
  game.values=[...game.solution]; complete(game,progress,false,scores); delete game.credited;
  save(game,settings,progress);
  const restored=load(); assert.equal(restored.scores.points,1800); assert.equal(restored.game.credited,true);
  save(restored.game,restored.settings,restored.progress,restored.scores);
  assert.equal(load().scores.points,1800);
  save(game,{...settings,tracking:true},{...emptyProgress(),total:4,easy:4,points:7000,best:2000});
  const legacy=load();
  assert.deepEqual(legacy.scores,{points:7000,best:2000,solved:4});
  assert.equal(legacy.progress.total,4);
});

test('restart keeps the same puzzle, clears the attempt and prevents repeat credit', () => {
  const original=createGame(generate('easy',50)), index=original.puzzle.findIndex(n=>!n), progress=emptyProgress(), scores=emptyScores();
  enter(original,index,original.solution[index]%9+1); original.elapsedMs=12000;
  const fresh=restartGame(original);
  assert.deepEqual(fresh.puzzle,original.puzzle); assert.equal(fresh.seed,original.seed); assert.deepEqual(fresh.values,original.puzzle);
  assert.equal(fresh.elapsedMs,0); assert.equal(fresh.mistakes,0); assert.equal(fresh.history.length,0); assert.ok(fresh.notes.every(n=>n===0));
  fresh.values=[...fresh.solution]; complete(fresh,progress,false,scores);
  const replay=restartGame(fresh); replay.values=[...replay.solution]; complete(replay,progress,true,scores);
  assert.equal(scores.points,1800); assert.equal(scores.solved,1); assert.equal(progress.total,0); assert.equal(validGame(replay),true);
});
