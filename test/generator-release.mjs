import assert from 'node:assert/strict';
import { generate, countSolutions, solveLogic, isSolved } from '../web/sudoku/engine.mjs';
for (const difficulty of ['easy','medium','hard']) {
  const start = performance.now();
  for (let seed = 0; seed < 1000; seed++) {
    const puzzle = generate(difficulty, seed);
    assert.equal(countSolutions(puzzle.puzzle), 1, `${difficulty}:${seed}: uniqueness`);
    assert.equal(isSolved(puzzle.solution), true, `${difficulty}:${seed}: solution`);
    assert.equal(solveLogic(puzzle.puzzle).solved, true, `${difficulty}:${seed}: logic`);
    assert.ok(puzzle.puzzle.every((n, i) => !n || n === puzzle.solution[i]), `${difficulty}:${seed}: givens`);
  }
  console.log(`${difficulty}: 1000 seeds passed in ${Math.round(performance.now() - start)} ms`);
}
