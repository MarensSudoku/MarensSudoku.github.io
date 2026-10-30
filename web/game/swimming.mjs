import {Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {WALKING_TYPES} from '../reef-layout.mjs';

export function tailWeight(x, min, max) {
  const tail = Math.max(0, Math.min(1, ((max - x) / (max - min || 1) - 0.35) / 0.65));
  return tail * tail;
}

export function swimPose(time, { phase, speed, radius, depth, height }) {
  const angle = time * speed + phase;
  const vx = Math.cos(angle) * radius, vz = -Math.sin(angle) * 1.5;
  return { x:Math.sin(angle) * radius, y:height + Math.sin(angle * 2 + phase) * 0.2, z:depth + Math.cos(angle) * 1.5, yaw:Math.atan2(-vz, vx) };
}

export function schoolPose(time, { phase, speed, radius, depth, height, member }) {
  const angle = time * speed + phase;
  const lane = Math.floor(member / 4), column = member % 4;
  const vx = Math.cos(angle) * radius, vz = -Math.sin(angle) * 1.1;
  const length = Math.hypot(vx,vz), forwardX = vx/length, forwardZ = vz/length;
  const behind = column*.55+Math.sin(member*4.13)*.18, sideways = (lane-1)*.4+Math.sin(member*2.37)*.16;
  const x = Math.sin(angle)*radius-behind*forwardX-sideways*forwardZ;
  const z = depth+Math.cos(angle)*1.1-behind*forwardZ+sideways*forwardX;
  return { x, y:height+lane*.18+Math.sin(angle*2+column*.5)*.1, z, yaw:Math.atan2(-vz,vx) };
}

export function swayWeight(height, min, max) {
  const weight = Math.max(0, Math.min(1, (height - min) / (max - min || 1)));
  return weight * weight;
}

const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

export function jellyfishTargets(positions,minY,maxY) {
  const height=maxY-minY||1,closed=Float32Array.from(positions),sine=Float32Array.from(positions),cosine=Float32Array.from(positions);
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i],y=positions[i+1],z=positions[i+2],h=(y-minY)/height;
    const bell=Math.max(smooth((h-.32)/.13),smooth((Math.hypot(x,z)/height-.42)/.18)),rim=1-smooth((h-.45)/.55);
    const contraction=.30*bell*(.45+.55*rim);
    closed[i]=x*(1-contraction);closed[i+2]=z*(1-contraction);
    closed[i+1]+=height*bell*(.035*(1-rim)-.025*rim);
    const trailing=1-smooth((h-.05)/.47),amplitude=height*.11*trailing,phase=trailing*4+x/height*2-z/height*1.4;
    sine[i]+=amplitude*Math.cos(phase);sine[i+2]+=amplitude*.6*Math.sin(phase);
    cosine[i]+=amplitude*Math.sin(phase);cosine[i+2]-=amplitude*.6*Math.cos(phase);
  }
  return [closed,sine,cosine];
}

export function jellyfishInfluences(seconds) {
  const cycle=((seconds/2.6)%1+1)%1;
  const pulse=cycle<.28?smooth(cycle/.28):1-smooth((cycle-.28)/.72),wave=seconds*Math.PI*2/2.6-.65;
  return [pulse,Math.sin(wave),Math.cos(wave)];
}

export function seahorseFinTargets(positions) {
  let minY=Infinity,maxY=-Infinity;
  for(let i=1;i<positions.length;i+=3){minY=Math.min(minY,positions[i]);maxY=Math.max(maxY,positions[i]);}
  const height=maxY-minY||1,sine=Float32Array.from(positions),cosine=Float32Array.from(positions);
  for(let i=0;i<positions.length;i+=3){
    const h=(positions[i+1]-minY)/height;
    const weight=smooth((h-.43)/.06)*smooth((.67-h)/.05)*smooth((-positions[i+2]/height-.16)/.065)*smooth((.045-Math.abs(positions[i])/height)/.035);
    const phase=h*20,amplitude=height*.018*weight;
    sine[i]+=amplitude*Math.cos(phase);cosine[i]+=amplitude*Math.sin(phase);
  }
  return [sine,cosine];
}

export const seahorseFinInfluences=seconds=>[Math.sin(seconds*Math.PI*10),Math.cos(seconds*Math.PI*10)];

export function shrimpLegTargets(positions,minY,maxY,length) {
  const height=maxY-minY||1,lift=Float32Array.from(positions),sine=Float32Array.from(positions),cosine=Float32Array.from(positions);
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i],y=positions[i+1],z=positions[i+2],h=(y-minY)/height;
    const weight=(1-smooth((h-.12)/.43))*smooth((Math.abs(z)/length-.012)/.04),phase=x/length*18+(z<0?Math.PI:0);
    const step=length*.03*weight,raise=length*.012*weight;
    lift[i+1]+=raise;
    sine[i]+=step*Math.cos(phase);sine[i+1]+=raise*Math.sin(phase);
    cosine[i]+=step*Math.sin(phase);cosine[i+1]-=raise*Math.cos(phase);
  }
  return [lift,sine,cosine];
}

export const shrimpLegInfluences=seconds=>[1,Math.sin(seconds*Math.PI*2/1.1),Math.cos(seconds*Math.PI*2/1.1)];

export function aquariumPose(time, object) {
  if(object.motion==='rest'||object.motion==='still'&&!WALKING_TYPES.includes(object.type))return {x:object.x,y:object.y,z:object.z,yaw:object.yaw,pitch:object.pitch||0,roll:object.roll||0};
  const settings={phase:object.phase,speed:object.baseSpeed*object.speed,radius:object.radius,depth:object.z,height:object.y,member:object.member};
  let pose;
  if(WALKING_TYPES.includes(object.type)&&object.motion==='still') {
    const step=time*object.speed*(object.type==='reef-crab'?1:object.baseSpeed/.1),reach=object.radius/3;
    pose={x:Math.sin(step*.16)*1.4*reach,y:object.y,z:object.z+Math.cos(step*.11)*.5*reach,yaw:0};
  } else if(object.motion==='circle'||object.motion==='school') {
    pose=object.motion==='school'?schoolPose(time,settings):swimPose(time,settings);
  } else {
    const angle=time*settings.speed+object.phase, x=Math.sin(angle)*object.radius;
    const z=object.motion==='eight'?Math.sin(angle*2)*1.5:Math.cos(angle)*.35;
    const vx=Math.cos(angle)*object.radius, vz=object.motion==='eight'?Math.cos(angle*2)*3:-Math.sin(angle)*.35;
    pose={x,y:object.y+Math.sin(angle*2)*.12,z:object.z+z,yaw:Math.atan2(-vz,vx)};
  }
  if(WALKING_TYPES.includes(object.type))pose.y=object.y;
  const rotation=Quaternion.RotationYawPitchRoll(object.yaw,object.pitch||0,object.roll||0);
  const offset=new Vector3(pose.x,pose.y-object.y,pose.z-object.z);
  offset.rotateByQuaternionToRef(rotation,offset);
  const facing=rotation.multiply(Quaternion.RotationYawPitchRoll(pose.yaw,0,0)).toEulerAngles();
  return {x:object.x+offset.x,y:object.y+offset.y,z:object.z+offset.z,yaw:facing.y,pitch:facing.x,roll:facing.z};
}
