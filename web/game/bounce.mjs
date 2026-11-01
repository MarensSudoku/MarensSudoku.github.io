const axes=['x','y','z'];

export function bounceLimits(box,axis,planes) {
  let min=-Infinity,max=Infinity;
  for(const plane of planes){
    let clearance=plane.d-.03,rate=0;
    for(const key of axes){
      const normal=plane.normal[key];
      clearance+=normal*(normal>=0?box.min[key]:box.max[key]);rate+=normal*axis[key];
    }
    if(Math.abs(rate)<1e-9){if(clearance<0)return {min:1,max:0};}
    else if(rate>0)min=Math.max(min,-clearance/rate);
    else max=Math.min(max,-clearance/rate);
  }
  return {min,max};
}

export function bounceStep(box,axis,distance,direction,limits,contact) {
  if(limits.min>limits.max)return {offset:0,direction,turned:false};
  let offset=Math.max(limits.min,Math.min(limits.max,0));
  if(distance<=1e-8)return {offset,direction,turned:false};
  const shifted={min:{},max:{}},travel={};
  for(const key of axes){shifted.min[key]=box.min[key]+axis[key]*offset;shifted.max[key]=box.max[key]+axis[key]*offset;travel[key]=axis[key]*direction;}
  const edge=direction>0?limits.max-offset:offset-limits.min;
  const free=Math.max(0,Math.min(edge,edge>0?contact(shifted,travel,Math.min(edge,distance),offset):Infinity));
  offset+=direction*Math.min(free,distance);const turned=free<=distance+1e-8;
  return {offset,direction:turned?-direction:direction,turned};
}

export function coarseContact(box,axis,obstacles) {
  let distance=Infinity;
  for(const other of obstacles){
    let near=-Infinity,far=Infinity;
    for(const key of axes){
      const low=other.min[key]-box.max[key],high=other.max[key]-box.min[key],rate=axis[key];
      if(Math.abs(rate)<1e-9){if(low>0||high<0){far=-Infinity;break;}}
      else{near=Math.max(near,Math.min(low/rate,high/rate));far=Math.min(far,Math.max(low/rate,high/rate));}
    }
    if(near>=-1e-8&&far>1e-8&&far>=near)distance=Math.min(distance,Math.max(0,near));
  }
  return distance;
}
