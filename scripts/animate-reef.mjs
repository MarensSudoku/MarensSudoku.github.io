import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Matrix,Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {REEF_ADDITIONS} from '../web/reef-additions.mjs';

export function animateReefModel(bytes,type) {
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonSize=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonSize));
  assert.equal(gltf.buffers.length,1);assert.ok(gltf.skins?.length,'A skinned model is required');
  assert.ok(!gltf.animations?.length,'Keep existing animations rather than replacing them');
  let binary;
  for(let offset=20+jsonSize;offset<bytes.length;){const length=bytes.readUInt32LE(offset);if(bytes.readUInt32LE(offset+4)===0x004e4942)binary=bytes.subarray(offset+8,offset+8+length);offset+=8+length;}
  assert.ok(binary);assert.equal(gltf.buffers[0].uri,undefined);
  const parents=new Map(),worlds=new Map(),jointIds=new Set(gltf.skins.flatMap(skin=>skin.joints));
  gltf.nodes.forEach((node,i)=>(node.children||[]).forEach(child=>parents.set(child,i)));
  function world(i) {
    if(worlds.has(i))return worlds.get(i);
    const node=gltf.nodes[i],local=node.matrix?Matrix.FromArray(node.matrix):Matrix.Compose(Vector3.FromArray(node.scale||[1,1,1]),Quaternion.FromArray(node.rotation||[0,0,0,1]),Vector3.FromArray(node.translation||[0,0,0]));
    const matrix=parents.has(i)?local.multiply(world(parents.get(i))):local;worlds.set(i,matrix);return matrix;
  }
  const named=new Map([...jointIds].map(i=>[gltf.nodes[i].name,i]));
  const bone=number=>{const id=named.get('Bone_'+String(number).padStart(3,'0'));assert.notEqual(id,undefined,'Missing joint '+number+' in '+type);return id;};
  const position=id=>Vector3.TransformCoordinates(Vector3.Zero(),world(id));
  function chain(number) {
    const result=[];let id=bone(number);
    while(true){assert.ok(!result.includes(id));result.push(id);const children=(gltf.nodes[id].children||[]).filter(child=>jointIds.has(child));if(children.length!==1)break;id=children[0];}
    return result;
  }
  const tracks=new Map(),up=new Vector3(0,1,0),forward=new Vector3(0,0,1);
  const add=(id,axis,amplitude,{phase=0,cycles=1,shape='sin',idle=.2,bias=0}={})=>{
    assert.ok(jointIds.has(id)&&Math.abs(amplitude)<=.3&&Math.abs(bias)<.7);
    const localAxis=Vector3.TransformNormal(axis,world(id).clone().invert()).normalize();
    assert.ok(localAxis.lengthSquared()>.9);
    if(!tracks.has(id))tracks.set(id,[]);
    tracks.get(id).push({axis:localAxis,amplitude,phase,cycles,shape,idle,bias});
  };
  function sway(number,axis,amplitude,options={}) {
    const joints=chain(number),count=Math.max(1,joints.length-1);
    joints.slice(0,count).forEach((id,i)=>add(id,axis,amplitude*(options.falloff??.8)**i,{...options,phase:(options.phase||0)-i*(options.lag??.55)}));
  }
  function legs(numbers,normal=up,direction=forward) {
    const starts=numbers.map(number=>({number,id:bone(number)})).sort((a,b)=>Vector3.Dot(position(a.id),direction)-Vector3.Dot(position(b.id),direction));
    starts.forEach(({number,id},i)=>{
      const joints=chain(number),reach=position(joints.at(-1)).subtract(position(id)),side=Math.sign(position(id).x)||1;
      const phase=Math.floor(i/2)*Math.PI*.8+(side<0?Math.PI:0),lift=Vector3.Cross(reach,normal).normalize();
      add(id,normal,.07,{phase,cycles:4,idle:0});
      add(id,lift,.045,{phase,cycles:4,shape:'lift',idle:0});
      if(joints.length>3)add(joints[Math.floor(joints.length/2)],lift,-.018,{phase,cycles:4,shape:'lift',idle:0});
    });
  }
  function arms(numbers,normal=up,amplitude=.035) {
    numbers.forEach((number,i)=>{
      const joints=chain(number),reach=position(joints.at(-1)).subtract(position(joints[0]));
      const lift=Vector3.Cross(reach,normal).normalize(),phase=i*Math.PI*2/numbers.length;
      sway(number,normal,amplitude,{phase,falloff:.94,lag:.55,idle:.25});
      sway(number,lift,amplitude*.65,{phase,falloff:.85,lag:.7,shape:'lift',idle:.12});
    });
  }
  let duration=4;
  switch(type) {
    case 'octopus':arms([11,18,25,32,39,46,53,60]);break;
    case 'manta-ray':
      for(const [number,side] of [[12,-1],[20,1]]){
        const joints=chain(number);let previous=0;
        for(let i=0;i<joints.length-1;i++){
          const reach=position(joints[i+1]).subtract(position(joints[i]));if(side*reach.x<=0)break;
          const correction=-Math.atan2(reach.y,side*reach.x),along=i/(joints.length-2),axis=new Vector3(0,0,side);
          add(joints[i],axis,i===0?.20:.018*(1-along*.4),{bias:correction-previous,cycles:2,phase:-i*.035,idle:.65});
          add(joints[i],axis,.035*along*along,{cycles:2,shape:'lift',idle:.65});previous=correction;
        }
      }
      sway(31,up,.04,{falloff:.88,lag:.4,idle:.65});
      sway(31,new Vector3(1,0,0),.012,{falloff:.9,lag:.4,phase:Math.PI/2,idle:.5});
      sway(43,up,.012,{idle:.5});sway(50,up,-.012,{idle:.5});break;
    case 'sea-turtle':
      sway(12,new Vector3(0,0,-1),.18,{lag:.2,falloff:.55,idle:.3});
      sway(16,new Vector3(0,0,1),.18,{lag:.2,falloff:.55,idle:.3});
      sway(3,up,.045,{phase:Math.PI,idle:.3});sway(5,up,-.045,{phase:Math.PI,idle:.3});
      sway(8,up,.012,{idle:.5});break;
    case 'seahorse':
      duration=6;add(bone(0),new Vector3(1,0,0),.04,{idle:.65});
      sway(12,new Vector3(1,0,0),.032,{falloff:.93,lag:.45,idle:.7});
      add(bone(25),up,.025,{idle:.5});break;
    case 'pistol-shrimp':
      legs([16,21,26,31,36,41,46,51]);sway(9,new Vector3(1,0,0),.012,{idle:.3});
      add(bone(73),up,.14,{shape:'snap',idle:.6});add(bone(75),up,-.09,{shape:'snap',idle:.6});
      sway(61,up,.012,{idle:.8});break;
    case 'spiny-lobster':
      legs([12,16,20,24,28,34,38,44,48,52]);
      sway(75,up,.025,{falloff:.8,idle:.8});sway(80,up,-.025,{phase:1,falloff:.8,idle:.8});
      sway(6,new Vector3(1,0,0),.008,{idle:.3});break;
    case 'starfish':duration=12;arms([6,12,18,24,30],new Vector3(0,0,1),.006);break;
    case 'treasure-chest':duration=8;add(bone(3),new Vector3(-1,0,0),.12,{shape:'open',idle:0});break;
    default:throw new Error('No animation profile for '+type);
  }
  const segments=[binary],offsetStart=binary.length;let binarySize=offsetStart;
  function accessor(values,components) {
    const array=Float32Array.from(values);assert.ok(array.every(Number.isFinite));
    const data=Buffer.from(array.buffer),view=gltf.bufferViews.push({buffer:0,byteOffset:binarySize,byteLength:data.length})-1;
    segments.push(data);binarySize+=data.length;
    const item={bufferView:view,componentType:5126,count:array.length/components,type:components===1?'SCALAR':'VEC4'};
    if(components===1){item.min=[array[0]];item.max=[array.at(-1)];}
    return gltf.accessors.push(item)-1;
  }
  const smooth=t=>t*t*(3-2*t);
  function wave(part,time,length) {
    const angle=time/length*Math.PI*2*part.cycles+part.phase;
    if(part.shape==='lift')return Math.max(0,Math.sin(angle));
    if(part.shape==='open')return (1-Math.cos(angle))/2;
    if(part.shape==='snap'){
      const fraction=((angle/(Math.PI*2))%1+1)%1;
      return fraction<.6?0:fraction<.82?smooth((fraction-.6)/.22):fraction<.86?1-smooth((fraction-.82)/.04):0;
    }
    return Math.sin(angle);
  }
  gltf.animations=[];
  for(const name of ['idle','move']) {
    const length=name==='idle'?duration*2:duration,count=Math.round(length*24)+1,times=Array.from({length:count},(_,i)=>i*length/(count-1));
    const input=accessor(times,1),animation={name,samplers:[],channels:[],extras:{loop:true,duration:length}};
    for(const [id,parts] of tracks) {
      const active=parts.filter(part=>name!=='idle'||part.idle>0);if(!active.length)continue;
      const node=gltf.nodes[id];assert.equal(node.matrix,undefined,'Animated joints must use TRS');
      const base=Quaternion.FromArray(node.rotation||[0,0,0,1]),values=[];let previous;
      for(let frame=0;frame<count;frame++) {
        const time=frame===count-1?0:times[frame];let rotation=base.clone();
        for(const part of active)rotation=rotation.multiply(Quaternion.RotationAxis(part.axis,part.bias+part.amplitude*(name==='idle'?part.idle:1)*wave(part,time,length)));
        rotation.normalize();if(previous&&Quaternion.Dot(previous,rotation)<0)rotation.scaleInPlace(-1);
        values.push(...rotation.asArray());previous=rotation;
      }
      const output=accessor(values,4),sampler=animation.samplers.push({input,output,interpolation:'LINEAR'})-1;
      animation.channels.push({sampler,target:{node:id,path:'rotation'}});
    }
    // A still chest keeps its lid in the bind pose until its opening clip is selected.
    if(!animation.channels.length){const id=bone(3),rotation=gltf.nodes[id].rotation||[0,0,0,1];const output=accessor(times.flatMap(()=>rotation),4);animation.samplers.push({input,output,interpolation:'LINEAR'});animation.channels.push({sampler:0,target:{node:id,path:'rotation'}});}
    gltf.animations.push(animation);
  }
  gltf.buffers[0].byteLength=binarySize;
  gltf.asset.extras={...gltf.asset.extras,reefAnimation:{type,fps:24,source:'Joint animations authored for this reef model'}};
  const jsonText=Buffer.from(JSON.stringify(gltf)),jsonPadding=(4-jsonText.length%4)%4,jsonChunk=Buffer.concat([jsonText,Buffer.alloc(jsonPadding,32)]),bin=Buffer.concat(segments);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+bin.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(bin.length);binHeader.writeUInt32LE(0x004e4942,4);
  return {bytes:Buffer.concat([header,jsonChunk,binHeader,bin]),clips:gltf.animations.map(animation=>({name:animation.name,duration:animation.extras.duration,channels:animation.channels.length})),sourceBinaryBytes:offsetStart};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [input,output,...selected]=process.argv.slice(2);assert.ok(input&&output,'Usage: node scripts/animate-reef.mjs INPUT_DIRECTORY OUTPUT_DIRECTORY [MODEL ...]');
  assert.notEqual(resolve(input),resolve(output),'Keep source rigs intact');await mkdir(output,{recursive:true});
  const supported=REEF_ADDITIONS.filter(spec=>spec.rigged).map(spec=>spec.id+'.glb');
  const files=(await readdir(input)).filter(file=>supported.includes(file)&&(!selected.length||selected.includes(file.replace('.glb',''))));
  assert.ok(files.length,'No supported reef rigs found');
  for(const file of files){const result=animateReefModel(await readFile(join(input,file)),file.replace('.glb',''));await writeFile(join(output,file),result.bytes);console.log(file+': '+result.clips.map(clip=>clip.name+' '+clip.channels+' joints / '+clip.duration+'s').join(', '));}
}
