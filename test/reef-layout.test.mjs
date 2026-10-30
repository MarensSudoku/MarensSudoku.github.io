import test from 'node:test';
import assert from 'node:assert/strict';
import { reefObject,validReefLayout,readReefLayout,saveReefLayout,REEF_STORAGE_KEY,MAX_REEF_OBJECTS } from '../web/reef-layout.mjs';
import { aquariumPose } from '../web/game/swimming.mjs';
import {Matrix,Vector3} from '@babylonjs/core/Maths/math.vector.js';

test('reef storage validates geometry, model names, behaviours and unique IDs',()=>{
  const object=reefObject('blue-tang','my-fish',{motion:'eight',speed:1.7,x:2,z:4});
  const layout={schema:1,objects:[object]}; assert.equal(validReefLayout(layout),true);
  for(const patch of [{type:'remote.glb'},{x:NaN},{scale:0},{speed:100},{motion:'unknown'},{member:-1},{extra:'payload'}])assert.equal(validReefLayout({schema:1,objects:[{...object,...patch}]}),false);
  assert.equal(validReefLayout({schema:1,objects:[object,object]}),false);
  assert.equal(validReefLayout({schema:1,objects:Array.from({length:MAX_REEF_OBJECTS+1},(_,i)=>({...object,id:'fish-'+i}))}),false);
  const distant=reefObject('reef-ledge','distant-rock',{x:26,y:14,z:68});
  assert.equal(validReefLayout({schema:1,objects:[distant]}),true);
  for(const patch of [{x:31},{y:17},{z:81}])assert.equal(validReefLayout({schema:1,objects:[{...distant,...patch}]}),false);
  assert.equal(validReefLayout({schema:1,objects:[{...object,pitch:.7,roll:-1.2}]}),true);
  for(const patch of [{pitch:NaN},{roll:7}])assert.equal(validReefLayout({schema:1,objects:[{...object,...patch}]}),false);
  for(const hue of [0,180,360])assert.equal(validReefLayout({schema:1,objects:[{...object,hue}]}),true);
  for(const hue of [-1,361,NaN])assert.equal(validReefLayout({schema:1,objects:[{...object,hue}]}),false);
});

test('personal reef saves independently and corrupt or unavailable storage is preserved',()=>{
  const data=new Map([['marenssudoku:state:v1','untouched game']]);
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const layout={schema:1,objects:[reefObject('anemone','my-anemone',{x:-3,z:-4})]};
  assert.equal(saveReefLayout(layout,storage),true);assert.deepEqual(readReefLayout(storage),{layout,problem:false});
  assert.equal(data.get('marenssudoku:state:v1'),'untouched game');
  data.set(REEF_STORAGE_KEY,'bad saved reef');assert.deepEqual(readReefLayout(storage),{layout:null,problem:true});assert.equal(data.get(REEF_STORAGE_KEY),'bad saved reef');
  assert.equal(saveReefLayout(layout,{setItem(){throw new Error('Quota full');}}),false);
  const legacy={...layout.objects[0]};delete legacy.pitch;delete legacy.roll;delete legacy.hue;
  const legacyText=JSON.stringify({schema:1,objects:[legacy]});data.set(REEF_STORAGE_KEY,legacyText);
  assert.deepEqual(readReefLayout(storage),{layout,problem:false},'older reefs acquire zero X/Z rotations without losing their objects');
  assert.equal(data.get(REEF_STORAGE_KEY),legacyText,'reading an older reef must not rewrite its saved data');
});

test('fish routes remain anchored, follow configured speed, and face forwards when rotated',()=>{
  for(const motion of ['circle','patrol','eight'])for(const yaw of [-.7,0,1.2]) {
    const object=reefObject('clownfish','fish',{motion,yaw,x:2,y:3,z:4,radius:3});
    assert.deepEqual(aquariumPose(10,{...object,speed:2}),aquariumPose(20,object));
    for(let time=0;time<60;time+=.4) {
      const pose=aquariumPose(time,object),next=aquariumPose(time+.001,object);
      const dx=next.x-pose.x,dz=next.z-pose.z;
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok((Math.cos(pose.yaw)*dx-Math.sin(pose.yaw)*dz)/Math.hypot(dx,dz)>.99);
      assert.ok(Math.hypot(pose.x-object.x,pose.z-object.z)<=Math.hypot(3,1.5)+.001);
    }
  }
  const still=reefObject('blue-tang','fish',{motion:'still',x:2,y:3,z:4,yaw:.7});
  assert.deepEqual(aquariumPose(0,still),aquariumPose(200,still));
});

test('crab speed and radius control its ground route while preserving the default motion',()=>{
  const crab=reefObject('reef-crab','crab',{x:2,y:.025,z:4});
  for(const time of [0,3,11,29]){
    const normal=aquariumPose(time,crab),wider=aquariumPose(time,{...crab,radius:6});
    assert.deepEqual(aquariumPose(time,{...crab,speed:2}),aquariumPose(time*2,crab));
    assert.ok(Math.abs(normal.x-crab.x-Math.sin(time*.16)*1.4)<1e-10);
    assert.ok(Math.abs(normal.z-crab.z-Math.cos(time*.11)*.5)<1e-10);
    for(const key of ['x','z'])assert.ok(Math.abs(wider[key]-crab[key]-(normal[key]-crab[key])*2)<1e-10);
    assert.equal(wider.y,crab.y);
    assert.equal(validReefLayout({schema:1,objects:[{...crab,speed:2,radius:6}]}),true);
  }
});

test('all moving routes and school formations rotate rigidly with every object axis',()=>{
  for(const motion of ['circle','patrol','eight','school','crab'])for(const angles of [{pitch:Math.PI/2,roll:0,yaw:0},{pitch:0,roll:Math.PI/2,yaw:0},{pitch:.7,roll:-.9,yaw:1.1}]){
    const object=reefObject(motion==='crab'?'reef-crab':'clownfish','moving',{motion:motion==='crab'?'still':motion,x:2,y:4,z:6,phase:.6,member:5});
    const matrix=Matrix.RotationYawPitchRoll(angles.yaw,angles.pitch,angles.roll);
    for(const time of [0,3,11,29]){
      const base=aquariumPose(time,object),rotated=aquariumPose(time,{...object,...angles});
      const expected=Vector3.TransformNormal(new Vector3(base.x-object.x,base.y-object.y,base.z-object.z),matrix);
      for(const key of ['x','y','z'])assert.ok(Math.abs(rotated[key]-object[key]-expected[key])<1e-6,`${motion} ${key} follows all rotations`);
      const forward=Vector3.TransformNormal(new Vector3(Math.cos(base.yaw),0,-Math.sin(base.yaw)),matrix);
      const actual=Vector3.TransformNormal(new Vector3(1,0,0),Matrix.RotationYawPitchRoll(rotated.yaw,rotated.pitch,rotated.roll));
      assert.ok(Vector3.Distance(forward,actual)<1e-6,`${motion} faces along its rotated route`);
    }
  }
});

test('crabs can choose ground routes or rest, and rest survives saving and loading',()=>{
  const crab=reefObject('reef-crab','crab',{x:2,y:.025,z:4,phase:.3});
  const routes=new Set();
  for(const motion of ['still','circle','patrol','eight']){
    const moving={...crab,motion};
    assert.equal(validReefLayout({schema:1,objects:[moving]}),true);
    assert.notDeepEqual(aquariumPose(0,moving),aquariumPose(20,moving));
    for(const time of [0,3,11,29]){
      assert.equal(aquariumPose(time,moving).y,crab.y,'walking routes must not make the crab bob above the ground');
      assert.deepEqual(aquariumPose(time,{...moving,speed:2}),aquariumPose(time*2,moving));
    }
    routes.add(JSON.stringify(aquariumPose(11,moving)));
  }
  assert.equal(routes.size,4,'each walking choice must use a different route');
  const resting={...crab,motion:'rest'},data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  assert.equal(saveReefLayout({schema:1,objects:[resting]},storage),true);
  const loaded=readReefLayout(storage).layout.objects[0];assert.equal(loaded.motion,'rest');
  assert.deepEqual(aquariumPose(0,loaded),aquariumPose(200,loaded));
  assert.equal(aquariumPose(200,loaded).x,crab.x);assert.equal(aquariumPose(200,loaded).z,crab.z);
  assert.equal(validReefLayout({schema:1,objects:[{...resting,type:'blue-tang'}]}),false,'the crab-only rest choice must not alter fish behaviour');
});
