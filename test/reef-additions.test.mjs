import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {REEF_ADDITIONS,canAddReefType} from '../web/reef-additions.mjs';
import {reefObject,validReefLayout,WALKING_TYPES,REEF_TYPES} from '../web/reef-layout.mjs';
import {aquariumPose} from '../web/game/swimming.mjs';
import {ACHIEVEMENTS,complete,createGame,emptyProgress,emptyScores,progressValue} from '../web/sudoku/model.mjs';
import {animateReefModel} from '../scripts/animate-reef.mjs';
import {load} from '../web/storage.mjs';

function glb(bytes){
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const size=bytes.readUInt32LE(12);
  return {json:JSON.parse(bytes.subarray(20,20+size)),binary:bytes.subarray(28+size)};
}
function floats(json,binary,index){
  const accessor=json.accessors[index],view=json.bufferViews[accessor.bufferView],offset=(view.byteOffset||0)+(accessor.byteOffset||0),components=accessor.type==='VEC4'?4:1;
  assert.equal(accessor.componentType,5126);assert.equal(view.byteStride,undefined);
  return Array.from({length:accessor.count*components},(_,i)=>binary.readFloatLE(offset+i*4));
}

test('renaming published achievements preserves saved badges and their conditions',()=>{
  const published=[['first','total',1],['flow','total',10],['magic','total',50],['stars','total',100],['variety','variety',3],['crown','hard',5],['direct','direct',1]];
  assert.deepEqual(ACHIEVEMENTS.slice(0,7).map(item=>[item.id,item.kind,item.target]),published);
  for(const achievement of ACHIEVEMENTS)assert.equal(REEF_ADDITIONS.filter(item=>item.unlock===achievement.id).length,1);
  const progress={total:100,easy:94,medium:1,hard:5,direct:1,unlocked:published.map(item=>item[0])},scores={points:1234,best:1234,solved:100};
  const stored=JSON.stringify({schema:1,game:null,settings:{language:'de',theme:'light',reducedMotion:false,showConflicts:true,tracking:true},progress,scores});
  const previous=globalThis.localStorage;globalThis.localStorage={getItem:()=>stored,setItem(){assert.fail('Loading renamed badges must not rewrite the save');}};
  try{const restored=load();assert.equal(restored.problem,false);assert.deepEqual(restored.progress,progress);assert.deepEqual(restored.scores,scores);}
  finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

test('retired objects are absent from the catalogue, models and previews',async()=>{
  const models=await readdir(new URL('../web/assets/models/',import.meta.url)),previews=await readdir(new URL('../web/assets/models/previews/',import.meta.url));
  for(const type of ['scallop-shell','porcelain-crab','hermit-crab','conch-shell','squid','cuttlefish','pearl-oyster']){
    assert.equal(REEF_TYPES.includes(type),false);assert.equal(reefObject(type,'removed'),null);
    assert.equal(models.includes(type+'.glb'),false);assert.equal(previews.includes(type+'.png'),false);
  }
});

test('six new achievements award their own reef objects at the configured milestone, once',()=>{
  const additions=ACHIEVEMENTS.slice(7);
  assert.equal(additions.length,6);assert.equal(new Set(REEF_ADDITIONS.map(item=>item.unlock)).size,13);
  for(const achievement of additions){
    assert.equal(REEF_ADDITIONS.filter(item=>item.unlock===achievement.id).length,1);
    const progress=emptyProgress(),scores=emptyScores(),difficulty=achievement.kind==='medium'?'medium':'easy';
    progress.total=achievement.target-1;progress[difficulty]=progress.total;
    if(achievement.kind==='direct')progress.direct=progress.total;
    assert.equal(progressValue(progress,achievement),achievement.target-1);
    const solution=Array.from({length:81},(_,i)=>(Math.floor(i/9)*3+Math.floor(i/27)+i%9)%9+1);
    const game=createGame({puzzle:Array(81).fill(0),solution,difficulty,seed:1});game.values=[...solution];game.usedUndo=achievement.kind!=='direct';
    const fresh=complete(game,progress,true,scores);
    assert.ok(fresh.some(item=>item.id===achievement.id),achievement.id);
    assert.equal(canAddReefType(REEF_ADDITIONS.find(item=>item.unlock===achievement.id).id,progress.unlocked),true);
    assert.deepEqual(complete(game,progress,true,scores),[]);assert.equal(progress.total,achievement.target);
  }
  const easyOnly={...emptyProgress(),easy:20,total:20};
  assert.equal(progressValue(easyOnly,ACHIEVEMENTS.find(item=>item.id==='trails')),0);
  assert.equal(progressValue(easyOnly,ACHIEVEMENTS.find(item=>item.id==='snap')),0);
});

test('seahorse unlocks after one round and manta after ten rounds',()=>{
  const progress=emptyProgress(),scores=emptyScores();
  const round=()=>{
    const game=createGame({puzzle:Array(81).fill(0),solution:Array.from({length:81},(_,i)=>(Math.floor(i/9)*3+Math.floor(i/27)+i%9)%9+1),difficulty:'easy',seed:1});
    game.values=[...game.solution];complete(game,progress,true,scores);
  };
  assert.equal(canAddReefType('manta-ray',progress.unlocked),false);
  assert.equal(canAddReefType('seahorse',progress.unlocked),false);
  round();assert.ok(progress.unlocked.includes('first'));
  assert.equal(canAddReefType('manta-ray',progress.unlocked),false);
  assert.equal(canAddReefType('seahorse',progress.unlocked),true);
  for(let i=1;i<10;i++)round();
  assert.equal(canAddReefType('manta-ray',progress.unlocked),true);
  assert.equal(canAddReefType('seahorse',progress.unlocked),true);
  for(const spec of REEF_ADDITIONS)if(spec.unlock)assert.ok(ACHIEVEMENTS.some(item=>item.id===spec.unlock));
});

test('all added models save; walking behaviours remain on the ground and can rest',()=>{
  assert.equal(REEF_ADDITIONS.length,13);
  assert.equal(validReefLayout({schema:1,objects:REEF_ADDITIONS.map(spec=>reefObject(spec.id,spec.id))}),true);
  for(const type of WALKING_TYPES){
    const object=reefObject(type,type,{x:2,y:.03,z:4});
    for(const motion of ['still','patrol','circle','eight']){
      assert.notDeepEqual(aquariumPose(0,{...object,motion}),aquariumPose(20,{...object,motion}));
      assert.equal(aquariumPose(11,{...object,motion}).y,object.y);
    }
    assert.deepEqual(aquariumPose(0,{...object,motion:'rest'}),aquariumPose(20,{...object,motion:'rest'}));
  }
});

test('new models have embedded assets, thumbnails and portable looping skeletal clips',async()=>{
  for(const spec of REEF_ADDITIONS){
    const bytes=await readFile(new URL('../web/assets/models/'+spec.id+'.glb',import.meta.url)),{json,binary}=glb(bytes);
    assert.ok(bytes.length<8*1024*1024);assert.equal(json.asset.version,'2.0');
    assert.ok(json.buffers.every(item=>!item.uri));assert.ok(json.images.every(item=>!item.uri&&Number.isInteger(item.bufferView)));
    assert.ok((json.extensionsUsed||[]).every(name=>!/draco|meshopt|basisu/i.test(name)));
    const triangles=json.meshes.flatMap(mesh=>mesh.primitives).reduce((total,primitive)=>total+json.accessors[primitive.indices].count/3,0);
    assert.ok(triangles>0&&triangles<20000,spec.id);
    const png=await readFile(new URL('../web/assets/models/previews/'+spec.id+'.png',import.meta.url));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    if(!spec.rigged)continue;
    assert.equal(json.skins.length,1);assert.deepEqual(json.animations.map(clip=>clip.name),['idle','move']);
    const joints=new Set(json.skins[0].joints);
    for(const clip of json.animations)for(const channel of clip.channels){
      assert.ok(joints.has(channel.target.node));assert.equal(channel.target.path,'rotation');
      const sampler=clip.samplers[channel.sampler],times=floats(json,binary,sampler.input),values=floats(json,binary,sampler.output);
      assert.equal(times[0],0);assert.equal(times.at(-1),clip.extras.duration);
      assert.ok(times.every((time,i)=>Number.isFinite(time)&&(!i||time>times[i-1])));
      assert.deepEqual(values.slice(0,4),values.slice(-4));
      for(let i=0;i<values.length;i+=4)assert.ok(Math.abs(Math.hypot(...values.slice(i,i+4))-1)<1e-6,spec.id+' normalized joint rotation');
    }
    assert.ok(json.meshes.flatMap(mesh=>mesh.primitives).every(primitive=>primitive.attributes.JOINTS_0!==undefined&&primitive.attributes.WEIGHTS_0!==undefined));
  }
});

test('animation authoring preserves source data and rejects replacing existing clips',()=>{
  const source={asset:{version:'2.0'},buffers:[{byteLength:4}],bufferViews:[],accessors:[],nodes:[{name:'Bone_003'}],skins:[{joints:[0]}]};
  let json=Buffer.from(JSON.stringify(source));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const input=Buffer.alloc(28+json.length+4);input.writeUInt32LE(0x46546c67);input.writeUInt32LE(2,4);input.writeUInt32LE(input.length,8);input.writeUInt32LE(json.length,12);input.writeUInt32LE(0x4e4f534a,16);json.copy(input,20);input.writeUInt32LE(4,20+json.length);input.writeUInt32LE(0x004e4942,24+json.length);input.writeUInt32LE(0x12345678,28+json.length);
  const before=Buffer.from(input),result=animateReefModel(input,'treasure-chest'),parsed=glb(result.bytes);
  assert.deepEqual(input,before);assert.deepEqual(parsed.json.nodes,source.nodes);assert.deepEqual(parsed.json.skins,source.skins);
  assert.equal(parsed.binary.readUInt32LE(0),0x12345678);assert.equal(result.sourceBinaryBytes,4);
  assert.throws(()=>animateReefModel(result.bytes,'treasure-chest'),/existing animations/);
  assert.throws(()=>animateReefModel(input,'missing'),/No animation profile/);
});
