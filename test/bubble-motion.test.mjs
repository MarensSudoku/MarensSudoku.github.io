import test from 'node:test';
import assert from 'node:assert/strict';
import { emitBubbles, advanceBubbles, MAX_BUBBLES } from '../web/game/bubble-motion.mjs';

const bubble = (patch = {}) => ({x:.5,y:.6,diameter:.03,birth:0,seed:.5,vx:0,vy:.2,speed:.9,changeAfter:0,splitAt:Infinity,...patch});
const volume = bubbles => bubbles.reduce((sum, value) => sum + value.diameter ** 3, 0);

test('bubble clouds deduplicate intersections and spawn in viewport coordinates', () => {
  const bounds = {left:100,top:200,width:450,height:450};
  const cloud = emitBubbles([0,0,40], bounds, {width:1000,height:800}, 3, () => .5);
  assert.equal(cloud.length,84);
  assert.equal(cloud[0].x * 800,125);
  assert.equal(cloud[42].x * 800,325);
  assert.ok(cloud.every(value => value.birth >= 3 && value.birth < 3.3 && value.y * 800 >= 200));
  assert.ok(cloud[0].diameter > cloud[1].diameter && cloud[1].diameter > cloud[4].diameter);
});

test('close bubbles merge while conserving air volume', () => {
  const source = [bubble({diameter:.02}),bubble({diameter:.03})], before = volume(source);
  const result = advanceBubbles(source,.3,.02,() => 0);
  assert.equal(result.length,1);
  assert.ok(Math.abs(volume(result) - before) < 1e-12);
  assert.ok(result[0].diameter > .03);
});

test('a full-board cloud covers every cell without exceeding the particle cap',()=>{
  const cloud=emitBubbles(Array.from({length:81},(_,i)=>i),{left:0,top:0,width:450,height:450},{width:1000,height:800},0,()=>.5);
  assert.ok(cloud.length<=MAX_BUBBLES);
  assert.equal(new Set(cloud.map(bubble=>Math.floor(bubble.y*800/50)*9+Math.floor(bubble.x*800/50))).size,81);
});

test('a large bubble divides into smaller bubbles while conserving air volume', () => {
  const source = [bubble({diameter:.05,splitAt:.2})], before = volume(source);
  const result = advanceBubbles(source,.3,.02,() => .5);
  assert.equal(result.length,4);
  assert.ok(result.every(value => value.diameter < .05 && value.splitAt === Infinity));
  assert.ok(Math.abs(volume(result) - before) < 1e-12);
});

test('bubbles wait for emission, rise out of the viewport and stay bounded', () => {
  const delayed = bubble({birth:1}); advanceBubbles([delayed],.5,.02);
  assert.equal(delayed.y,.6);
  let cloud = [bubble({y:1})];
  for (let time=.02;time<3;time+=.02) cloud = advanceBubbles(cloud,time,.02,() => .99);
  assert.equal(cloud.length,0);
  const crowded = Array.from({length:MAX_BUBBLES}, () => bubble({diameter:.005,splitAt:.2}));
  assert.ok(advanceBubbles(crowded,.3,.02).length <= MAX_BUBBLES);
});
