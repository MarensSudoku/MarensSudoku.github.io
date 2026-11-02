import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {createBubbleVent} from '../web/game/bubble-vent.mjs';
import {reefObject,validReefLayout,REEF_CATEGORIES} from '../web/reef-layout.mjs';
import {canAddReefType} from '../web/reef-additions.mjs';
import {load,defaults} from '../web/storage.mjs';

test('bubble vent is an achievement reward with a reusable stone and valid saved placement',()=>{
  assert.ok(REEF_CATEGORIES.decoration.includes('bubble-vent'));
  assert.equal(canAddReefType('bubble-vent',[]),false);
  assert.equal(canAddReefType('bubble-vent',['bubbles']),true);
  assert.equal(validReefLayout({schema:1,objects:[reefObject('bubble-vent','air',{x:2,y:.02,z:-3,scale:1.5,hue:180})]}),true);
  const engine=new NullEngine();
  try {
    const scene=new Scene(engine),stone=createBubbleVent(scene);
    assert.equal(stone.isEnabled(),false);
    assert.deepEqual(stone.metadata,{type:'bubble-vent',height:.17});
    assert.equal(stone.getChildMeshes().length,10);
    const copy=stone.clone('placed');copy.setEnabled(true);copy.scaling.setAll(1.5);copy.computeWorldMatrix(true);
    assert.equal(copy.getChildMeshes().length,10);
    assert.ok(copy.getHierarchyBoundingVectors(true).max.y>.2);
  }finally{engine.dispose();}
});

test('existing progress unlocks the new reward at five rounds without rewriting saved data',()=>{
  const previous=globalThis.localStorage;
  try {
    for(const total of [4,5,20]){
      const raw=JSON.stringify({schema:1,game:null,settings:{...defaults(),tracking:true},progress:{total,easy:total,medium:0,hard:0,direct:0,unlocked:[]},scores:{points:123,best:123,solved:total}});
      globalThis.localStorage={getItem:()=>raw,setItem(){assert.fail('Loading must not rewrite saved data');}};
      const restored=load();assert.equal(restored.problem,false);
      assert.equal(restored.progress.unlocked.includes('bubbles'),total>=5);
      assert.equal(restored.progress.total,total);assert.equal(restored.scores.points,123);
    }
  }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
