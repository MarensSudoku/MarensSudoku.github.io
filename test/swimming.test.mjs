import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { swimPose, schoolPose, tailWeight, swayWeight, jellyfishTargets, jellyfishInfluences, seahorseFinTargets, seahorseFinInfluences, shrimpLegTargets, shrimpLegInfluences } from '../web/game/swimming.mjs';

test('fish follow a bounded continuous route facing their direction of travel', () => {
  const animal = { phase:1.2, speed:0.1, radius:6, depth:4, height:2 };
  for (let time = 0; time < 100; time += 0.3) {
    const pose = swimPose(time, animal), next = swimPose(time + 0.001, animal);
    assert.ok(Math.abs(pose.x) <= 6 && pose.z >= 2.5 && pose.z <= 5.5 && pose.y >= 1.8 && pose.y <= 2.2);
    assert.ok(Math.cos(pose.yaw) * (next.x - pose.x) - Math.sin(pose.yaw) * (next.z - pose.z) > 0);
  }
});

test('tail bends smoothly while the head stays steady', () => {
  assert.equal(tailWeight(1, -1, 1), 0);
  assert.equal(tailWeight(-1, -1, 1), 1);
  assert.ok(tailWeight(-0.5, -1, 1) > tailWeight(0, -1, 1));
  assert.ok(Number.isFinite(tailWeight(0, 0, 0)));
});

test('all exported fish face forward after model normalization, with the tail at negative X', async () => {
  const { fish } = JSON.parse(await readFile(new URL('../web/assets/models/aquarium.json', import.meta.url)));
  for (const model of fish) {
    // The exported heads face -Z; glTF's handedness conversion maps this to +Z.
    const head = Vector3.TransformNormal(new Vector3(0, 0, 1), Matrix.RotationY(model.yaw));
    assert.ok(head.x > 0.999 && Math.abs(head.z) < 1e-6, model.file);
    assert.equal(tailWeight(head.x, -1, 1), 0);
    assert.ok(tailWeight(-head.x, -1, 1) > 0.999);
  }
});

test('school members stay together and turn with their leader', () => {
  const route={phase:.5,speed:.08,radius:4.5,depth:9,height:4};
  for(let time=0;time<100;time+=.7) {
    const leader=schoolPose(time,{...route,member:0});
    for(let member=0;member<12;member++) {
      const pose=schoolPose(time,{...route,member});
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(Math.hypot(pose.x-leader.x,pose.z-leader.z)<2.1);
      assert.equal(pose.yaw,leader.yaw);
    }
  }
});

test('water sway anchors roots and gives flexible tips the most motion', () => {
  assert.equal(swayWeight(-1,0,2),0); assert.equal(swayWeight(0,0,2),0);
  assert.equal(swayWeight(2,0,2),1); assert.equal(swayWeight(3,0,2),1);
  assert.ok(swayWeight(.5,0,2)<swayWeight(1.5,0,2));
  assert.ok(Number.isFinite(swayWeight(0,0,0)));
});

test('jellyfish bell contracts visibly while trailing arms wave from fixed attachments',()=>{
  const positions=Float32Array.from([0,1,0,1,.6,0,0,.52,0,.15,0,.05]),original=Float32Array.from(positions);
  const [closed,sine,cosine]=jellyfishTargets(positions,0,1);
  assert.deepEqual(positions,original);
  assert.ok(closed[3]<.8,'the bell rim must contract by more than twenty percent');
  assert.ok(closed[1]>1,'the dome changes height with its contraction');
  for(const target of [sine,cosine])for(let i=6;i<9;i++)assert.ok(Math.abs(target[i]-positions[i])<1e-8,'arms stay attached to the bell');
  assert.ok(Math.hypot(sine[9]-positions[9],cosine[9]-positions[9])>.1,'arm tips must move visibly');
  assert.deepEqual(Array.from(closed.slice(9,12)),Array.from(positions.slice(9,12)),'bell contraction must not scale the entire animal');
  assert.ok(jellyfishInfluences(.28*2.6)[0]>.999);assert.equal(jellyfishInfluences(0)[0],0);
  for(let time=0;time<6;time+=.13){
    const values=jellyfishInfluences(time);assert.ok(values.every(value=>Number.isFinite(value)&&Math.abs(value)<=1));
    const loop=jellyfishInfluences(time+2.6);values.forEach((value,i)=>assert.ok(Math.abs(value-loop[i])<1e-12));
  }
});

test('seahorse fin ripples without deforming its head, body or tail',()=>{
  const positions=Float32Array.from([0,.95,-.39,0,1.7,.2,.15,.9,-.1,0,0,-.2]),original=Float32Array.from(positions);
  const targets=seahorseFinTargets(positions);assert.deepEqual(positions,original);
  assert.ok(Math.hypot(targets[0][0],targets[1][0])>.02,'the dorsal fin needs a visible flutter');
  for(const target of targets){assert.deepEqual(Array.from(target.slice(3)),Array.from(positions.slice(3)));assert.equal(target[1],positions[1]);assert.equal(target[2],positions[2]);}
  const start=seahorseFinInfluences(0),quarter=seahorseFinInfluences(.05),loop=seahorseFinInfluences(.2);
  assert.notDeepEqual(start,quarter);start.forEach((value,i)=>assert.ok(Math.abs(value-loop[i])<1e-12));
});

test('shrimp legs step in opposite phases and lift without moving the body',()=>{
  const positions=Float32Array.from([0,0,.1,0,0,-.1,0,1,.1,0,.7,0]),original=Float32Array.from(positions);
  const targets=shrimpLegTargets(positions,0,1,1);assert.deepEqual(positions,original);
  for(const target of targets)assert.deepEqual(Array.from(target.slice(6)),Array.from(positions.slice(6)));
  const at=time=>{const weights=shrimpLegInfluences(time);return Array.from(positions,(value,i)=>value+targets.reduce((sum,target,k)=>sum+(target[i]-positions[i])*weights[k],0));};
  let stride=0;
  for(let time=0;time<1.1;time+=.04){
    const points=at(time);assert.ok(points[1]>=-1e-7&&points[4]>=-1e-7,'feet stay above the sand');
    assert.ok(Math.abs(points[0]+points[3])<1e-7,'left and right strides oppose each other');stride=Math.max(stride,Math.abs(points[0]));
  }
  assert.ok(stride>.025,'the stride must be visible');at(0).forEach((value,i)=>assert.ok(Math.abs(value-at(1.1)[i])<1e-7));
});
