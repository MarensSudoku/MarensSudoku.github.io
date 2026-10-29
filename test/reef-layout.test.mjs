import test from 'node:test';
import assert from 'node:assert/strict';
import { reefObject,validReefLayout,readReefLayout,saveReefLayout,REEF_STORAGE_KEY,MAX_REEF_OBJECTS } from '../web/reef-layout.mjs';
import { aquariumPose } from '../web/game/swimming.mjs';

test('reef storage validates geometry, model names, behaviours and unique IDs',()=>{
  const object=reefObject('blue-tang','my-fish',{motion:'eight',speed:1.7,x:2,z:4});
  const layout={schema:1,objects:[object]}; assert.equal(validReefLayout(layout),true);
  for(const patch of [{type:'remote.glb'},{x:NaN},{scale:0},{speed:100},{motion:'unknown'},{member:-1},{extra:'payload'}])assert.equal(validReefLayout({schema:1,objects:[{...object,...patch}]}),false);
  assert.equal(validReefLayout({schema:1,objects:[object,object]}),false);
  assert.equal(validReefLayout({schema:1,objects:Array.from({length:MAX_REEF_OBJECTS+1},(_,i)=>({...object,id:'fish-'+i}))}),false);
});

test('personal reef saves independently and corrupt or unavailable storage is preserved',()=>{
  const data=new Map([['marenssudoku:state:v1','untouched game']]);
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const layout={schema:1,objects:[reefObject('anemone','my-anemone',{x:-3,z:-4})]};
  assert.equal(saveReefLayout(layout,storage),true);assert.deepEqual(readReefLayout(storage),{layout,problem:false});
  assert.equal(data.get('marenssudoku:state:v1'),'untouched game');
  data.set(REEF_STORAGE_KEY,'bad saved reef');assert.deepEqual(readReefLayout(storage),{layout:null,problem:true});assert.equal(data.get(REEF_STORAGE_KEY),'bad saved reef');
  assert.equal(saveReefLayout(layout,{setItem(){throw new Error('Quota full');}}),false);
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
