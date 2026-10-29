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

export function aquariumPose(time, object) {
  if(object.motion==='still')return {x:object.x,y:object.y,z:object.z,yaw:object.yaw};
  const settings={phase:object.phase,speed:object.baseSpeed*object.speed,radius:object.radius,depth:object.z,height:object.y,member:object.member};
  let pose;
  if(object.motion==='circle'||object.motion==='school') {
    pose=object.motion==='school'?schoolPose(time,settings):swimPose(time,settings);
  } else {
    const angle=time*settings.speed+object.phase, x=Math.sin(angle)*object.radius;
    const z=object.motion==='eight'?Math.sin(angle*2)*1.5:Math.cos(angle)*.35;
    const vx=Math.cos(angle)*object.radius, vz=object.motion==='eight'?Math.cos(angle*2)*3:-Math.sin(angle)*.35;
    pose={x,y:object.y+Math.sin(angle*2)*.12,z:object.z+z,yaw:Math.atan2(-vz,vx)};
  }
  const c=Math.cos(object.yaw),s=Math.sin(object.yaw),z=pose.z-object.z;
  return {...pose,x:object.x+pose.x*c+z*s,z:object.z-pose.x*s+z*c,yaw:pose.yaw+object.yaw};
}
