import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { swimPose, schoolPose, tailWeight, swayWeight } from '../web/game/swimming.mjs';

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
