const keys=['x','y','z'];
const zero={x:0,y:0,z:0};

export function boxEntry(box,axis,other,shift=zero) {
  let near=-Infinity,far=Infinity;
  for(const key of keys){
    const low=other.min[key]-box.max[key]-shift[key],high=other.max[key]-box.min[key]-shift[key],rate=axis[key];
    if(Math.abs(rate)<1e-12){if(low>1e-7||high< -1e-7)return Infinity;}
    else{near=Math.max(near,Math.min(low/rate,high/rate));far=Math.min(far,Math.max(low/rate,high/rate));}
  }
  return far>=Math.max(0,near)-1e-7?Math.max(0,near):Infinity;
}

function refit(surface,node) {
  const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
  if(node.faces)for(const face of node.faces)for(let corner=0;corner<3;corner++){
    const vertex=surface.indices[face+corner]*3;
    for(let i=0;i<3;i++){const value=surface.positions[vertex+i];min[keys[i]]=Math.min(min[keys[i]],value);max[keys[i]]=Math.max(max[keys[i]],value);}
  }
  else for(const child of [node.left,node.right]){
    refit(surface,child);for(const key of keys){min[key]=Math.min(min[key],child.box.min[key]);max[key]=Math.max(max[key],child.box.max[key]);}
  }
  node.box={min,max};return node;
}

export function createSurface(positions,indices) {
  const surface={positions,indices};
  function build(faces){
    if(faces.length<=8)return refit(surface,{faces});
    const bounds=refit(surface,{faces}).box;
    const axis=keys.reduce((best,key)=>bounds.max[key]-bounds.min[key]>bounds.max[best]-bounds.min[best]?key:best,'x'),component=keys.indexOf(axis);
    const center=face=>positions[indices[face]*3+component]+positions[indices[face+1]*3+component]+positions[indices[face+2]*3+component];
    faces.sort((a,b)=>center(a)-center(b));const middle=Math.floor(faces.length/2);
    return refit(surface,{left:build(faces.slice(0,middle)),right:build(faces.slice(middle))});
  }
  surface.root=build(Array.from({length:indices.length/3},(_,i)=>i*3));return surface;
}

export function updateSurface(surface,positions) {
  surface.positions=positions;refit(surface,surface.root);
}

const subtract=(a,b)=>a.map((value,i)=>value-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

function triangleEntry(a,b,travel,maxDistance) {
  const edges=triangle=>[subtract(triangle[1],triangle[0]),subtract(triangle[2],triangle[1]),subtract(triangle[0],triangle[2])];
  const ae=edges(a),be=edges(b),an=cross(ae[0],ae[1]),bn=cross(be[0],be[1]);
  const axes=[an,bn,...ae.flatMap(edge=>be.map(other=>cross(edge,other))),...ae.map(edge=>cross(an,edge)),...be.map(edge=>cross(bn,edge))];
  let near=-Infinity,far=Infinity;
  for(const normal of axes){
    const length=Math.hypot(...normal);if(length<1e-12)continue;
    const axis=normal.map(value=>value/length),ap=a.map(point=>dot(point,axis)),bp=b.map(point=>dot(point,axis)),rate=dot(travel,axis);
    const low=Math.min(...bp)-Math.max(...ap),high=Math.max(...bp)-Math.min(...ap);
    if(Math.abs(rate)<1e-12){if(low>1e-7||high< -1e-7)return Infinity;}
    else{near=Math.max(near,Math.min(low/rate,high/rate));far=Math.min(far,Math.max(low/rate,high/rate));}
    if(far<Math.max(0,near)-1e-7||near>maxDistance+1e-7)return Infinity;
  }
  // A touch that ends immediately is movement away from the surface, not a new impact.
  return near>=-1e-7&&far>1e-7&&near<=maxDistance+1e-7?Math.max(0,near):Infinity;
}

export function surfaceContact(animal,obstacle,axis,maxDistance,shift=zero) {
  let distance=Infinity;
  const triangle=(surface,face,offset)=>Array.from({length:3},(_,corner)=>{
    const index=surface.indices[face+corner]*3;return keys.map((key,i)=>surface.positions[index+i]+offset[key]);
  });
  function visit(a,b){
    const entry=boxEntry(a.box,axis,b.box,shift);if(entry>Math.min(distance,maxDistance)+1e-7)return;
    if(a.faces&&b.faces){
      for(const af of a.faces)for(const bf of b.faces)distance=Math.min(distance,triangleEntry(triangle(animal,af,shift),triangle(obstacle,bf,zero),keys.map(key=>axis[key]),Math.min(distance,maxDistance)));
    }else if(!a.faces&&(b.faces||a.box.max.x-a.box.min.x+a.box.max.y-a.box.min.y+a.box.max.z-a.box.min.z>b.box.max.x-b.box.min.x+b.box.max.y-b.box.min.y+b.box.max.z-b.box.min.z)){
      visit(a.left,b);visit(a.right,b);
    }else{visit(a,b.left);visit(a,b.right);}
  }
  visit(animal.root,obstacle.root);return distance;
}
