import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, logicalHint, PEERS, UNITS } from '../web/sudoku/engine.mjs';
const ALL=0x3fe;
test('explained hints solve generated puzzles at every difficulty without guessing or changing the input', () => {
  const kinds = new Set();
  for (const difficulty of ['easy','medium','hard']) for(let seed=1;seed<=8;seed++) {
    const {puzzle,solution}=generate(difficulty,seed), grid=[...puzzle];
    while(grid.some(n=>!n)) {
      const before=[...grid], hint=logicalHint(grid); assert.deepEqual(grid,before);
      assert.ok(['single','hidden'].includes(hint.kind),JSON.stringify(hint));
      assert.equal(hint.value,solution[hint.index]); assert.equal(grid[hint.index],0);
      const masks=grid.map((n,i)=>n?0:PEERS[i].reduce((mask,j)=>mask&~(1<<grid[j]),ALL));
      for(const step of hint.steps) {
        kinds.add(step.kind);
        if(step.kind==='pair') {
          const pair=step.values.reduce((mask,n)=>mask|(1<<n),0);
          assert.equal(step.places.length,2); step.places.forEach(i=>assert.equal(masks[i],pair));
          step.targets.forEach(i=>{assert.ok(UNITS[step.unit].includes(i));assert.ok(!step.places.includes(i));masks[i]&=~pair;});
        } else {
          assert.deepEqual(UNITS[step.unit].filter(i=>masks[i]&(1<<step.value)),step.places);
          assert.ok(step.places.every(i=>UNITS[step.other].includes(i)));
          step.targets.forEach(i=>{assert.ok(UNITS[step.other].includes(i)&&!UNITS[step.unit].includes(i));masks[i]&=~(1<<step.value);});
        }
      }
      if(hint.kind==='single') assert.equal(masks[hint.index],1<<hint.value);
      else assert.deepEqual(UNITS[hint.unit].filter(i=>masks[i]&(1<<hint.value)),[hint.index]);
      grid[hint.index]=hint.value;
    }
    assert.deepEqual(logicalHint(grid),{kind:'solved'});
  }
  assert.ok(kinds.has('pair')&&kinds.has('locked'),'hard hints must explain both advanced deductions');
});
test('conflicting and impossible entries produce no misleading hint; unsupported puzzles are never guessed', () => {
  const {puzzle}=generate('easy',12), index=puzzle.findIndex(n=>!n), wrong=[...puzzle];
  wrong[index]=puzzle[PEERS[index].find(i=>puzzle[i])];
  assert.deepEqual(logicalHint(wrong),{kind:'blocked'});
  assert.deepEqual(logicalHint(null),{kind:'blocked'});
  assert.deepEqual(logicalHint(Array(81).fill(0)),{kind:'none'});
});
