import test from 'node:test';
import assert from 'node:assert/strict';
import {bounceLimits,bounceStep,coarseContact} from '../web/game/bounce.mjs';
import {aquariumPose} from '../web/game/swimming.mjs';
import {reefObject,validReefLayout,saveReefLayout,readReefLayout} from '../web/reef-layout.mjs';
import {boxEntry,createSurface,updateSurface,surfaceContact} from '../web/game/surface-collision.mjs';

const axis={x:1,y:0,z:0},box={min:{x:-.5,y:.1,z:-.3},max:{x:.5,y:1,z:.3}};
const rock=(x,y=0,z=0)=>({min:{x,y,z:z-.5},max:{x:x+.1,y:y+1,z:z+.5}});
const shift=(box,offset)=>({min:{...box.min,x:box.min.x+offset},max:{...box.max,x:box.max.x+offset}});
function boxSurface(box){
  const {min:a,max:b}=box;
  return createSurface([a.x,a.y,a.z,b.x,a.y,a.z,b.x,b.y,a.z,a.x,b.y,a.z,a.x,a.y,b.z,b.x,a.y,b.z,b.x,b.y,b.z,a.x,b.y,b.z],
    [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
}
function contactFor(box,obstacles){
  const animal=boxSurface(box),surfaces=obstacles.map(boxSurface);
  return (bounds,travel,distance,offset)=>Math.min(Infinity,...surfaces.map(surface=>surfaceContact(animal,surface,travel,distance,{x:offset,y:0,z:0})));
}

test('animals reverse at solid objects without passing through thin obstacles',()=>{
  const limits={min:-10,max:10};
  const hit=bounceStep(box,axis,3,1,limits,contactFor(box,[rock(2)]));
  assert.equal(hit.direction,-1);assert.ok(Math.abs(hit.offset-1.5)<1e-8);assert.equal(hit.turned,true,'Stop at contact before pausing and returning');
  assert.deepEqual(bounceStep(box,axis,3,1,limits,contactFor(box,[rock(2,2),rock(2,0,3)])),{offset:3,direction:1,turned:false},'Objects above or beside the animal do not block it');
  let offset=0,direction=1,turns=0;
  for(let i=0;i<200;i++){
    const current=shift(box,offset),result=bounceStep(current,axis,.1,direction,{min:-10-offset,max:10-offset},contactFor(current,[rock(2),rock(-2.1)]));
    offset+=result.offset;if(result.direction!==direction)turns++;direction=result.direction;
    assert.ok(offset>=-1.500001&&offset<=1.500001);
  }
  assert.ok(turns>=5,'An animal returns to the next obstacle repeatedly');
});

test('screen and distance planes keep the entire animal visible and adapt after resize',()=>{
  const planes=[{normal:{x:1,y:0,z:0},d:3},{normal:{x:-1,y:0,z:0},d:3}];
  const limits=bounceLimits(box,axis,planes);assert.ok(Math.abs(limits.min+2.47)<1e-10&&Math.abs(limits.max-2.47)<1e-10);
  const right=bounceStep(box,axis,3,1,limits,()=>Infinity);assert.equal(right.direction,-1);assert.ok(right.offset<=2.4700001);
  const outside=shift(box,4),resized=bounceStep(outside,axis,0,1,bounceLimits(outside,axis,planes),()=>Infinity);
  assert.ok(outside.max.x+resized.offset<=2.9700001,'Resizing brings the animal back inside the visible interval');
  const depth=bounceLimits(box,{x:0,y:0,z:1},[{normal:{x:0,y:0,z:-1},d:5}]);
  const far=bounceStep(box,{x:0,y:0,z:1},5,1,depth,()=>Infinity);assert.equal(far.direction,-1);assert.ok(far.offset<=4.6700001,'The animal returns before becoming too distant');
  assert.deepEqual(bounceStep(box,axis,1,1,{min:1,max:0},()=>Infinity),{offset:0,direction:1,turned:false},'An impossible placement cannot create invalid positions');
});

test('surface contact respects holes instead of stopping at an enclosing box',()=>{
  const parts=[boxSurface({min:{x:2,y:0,z:-1.2},max:{x:2.2,y:2,z:-.6}}),boxSurface({min:{x:2,y:0,z:.6},max:{x:2.2,y:2,z:1.2}})];
  const positions=parts.flatMap(part=>part.positions),indices=parts.flatMap((part,i)=>part.indices.map(index=>index+i*8));
  const obstacle=createSurface(positions,indices),animal=boxSurface(box);
  assert.ok(boxEntry(animal.root.box,axis,obstacle.root.box)<3,'The large enclosing boxes overlap along the path');
  assert.equal(surfaceContact(animal,obstacle,axis,3),Infinity,'The animal fits through the actual opening');
  assert.ok(Math.abs(coarseContact(box,axis,[obstacle.root.box])-1.5)<1e-8,'Fish use the enclosing box while crabs use the opening');
});

test('fish swim forward around a continuous return curve instead of flipping their body',()=>{
  const fish=reefObject('clownfish','fish',{motion:'bounce',y:2,z:3}),state={offset:1,direction:1,lane:0};let previous;
  for(let i=0;i<=40;i++){
    const pose=aquariumPose(0,fish,{...state,turn:{radius:.4,sign:1,progress:i/40}});
    if(previous){
      assert.ok(Math.cos(pose.yaw)*(pose.x-previous.x)-Math.sin(pose.yaw)*(pose.z-previous.z)>0,'The fish keeps moving in the direction it faces');
      assert.ok(Math.cos(pose.yaw-previous.yaw)>.99,'The body rotates gradually');
    }
    previous=pose;
  }
  const returned=aquariumPose(0,fish,{...state,direction:-1,lane:.8});
  for(const key of ['x','y','z'])assert.ok(Math.abs(returned[key]-previous[key])<1e-8,'Finishing the curve does not jump the body');
  assert.ok(Math.cos(returned.yaw-previous.yaw)>.999999);
});

test('animals reach sloped model surfaces and can move away after touching',()=>{
  const animal=boxSurface(box),slope=createSurface([2,0,1,4,0,-1,4,2,-1,2,2,1],[0,1,2,0,2,3]);
  assert.ok(Math.abs(surfaceContact(animal,slope,axis,4)-2.2)<1e-6,'The exact sloped surface is reached rather than its outer box');
  const wall=boxSurface(rock(2)),touching=boxSurface(shift(box,1.5));
  assert.equal(surfaceContact(touching,wall,axis,1),0);
  assert.equal(surfaceContact(touching,wall,{x:-1,y:0,z:0},1),Infinity,'Contact must not trap the animal after reversing');
  const moved=slope.positions.map((value,i)=>i%3===0?value+1:value);updateSurface(slope,moved);
  assert.ok(Math.abs(surfaceContact(animal,slope,axis,4)-3.2)<1e-6,'Moved and animated geometry updates its surface hierarchy');
});

test('fish turn to swim back while crabs keep facing forward, with saved mode retained',()=>{
  for(const type of ['clownfish','reef-crab']){
    const object=reefObject(type,type,{motion:'bounce',yaw:.4,x:1,y:2,z:3});assert.ok(object);
    const layout={schema:1,objects:[object]};assert.equal(validReefLayout(layout),true);let data;
    const storage={setItem:(key,value)=>data=value,getItem:()=>data};assert.equal(saveReefLayout(layout,storage),true);assert.deepEqual(readReefLayout(storage).layout,layout);
    const forward=aquariumPose(1,object,{offset:1,direction:1}),backward=aquariumPose(2,object,{offset:1,direction:-1});
    for(const key of ['x','y','z'])assert.equal(forward[key],backward[key],'Turning does not move the body');
    assert.ok(Math.abs(Math.cos(forward.yaw-backward.yaw)-(type==='clownfish'?-1:1))<1e-10);
  }
  assert.equal(reefObject('reef','static',{motion:'bounce'}),null);
});
