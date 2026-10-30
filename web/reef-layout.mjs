export const REEF_STORAGE_KEY = 'marenssudoku:reef:v1';
export const MAX_REEF_OBJECTS = 200;
export const FISH_TYPES = ['clownfish','blue-tang','butterflyfish','wrasse','anthias','chromis'];
export const REEF_TYPES = [...FISH_TYPES,'reef','reef-ledge','ribbon-grass','sea-fern','anemone','reef-crab','coral-fan','coral-staghorn','coral-plates','coral-brain','coral-tubes'];
export const FISH_MOTIONS = ['circle','patrol','eight','still','school'];
const ranges = {x:[-30,30],y:[0,16],z:[-8,80],scale:[.25,2.5],yaw:[-Math.PI*2,Math.PI*2],speed:[.1,3],radius:[.25,9],phase:[0,100],baseSpeed:[.01,.3]};
export function validReefObject(object) {
  return object && typeof object.id==='string' && /^[\w-]{1,64}$/.test(object.id) && REEF_TYPES.includes(object.type) &&
    Object.keys(object).every(key=>['id','type','motion','member',...Object.keys(ranges),'pitch','roll','hue'].includes(key)) &&
    Object.entries(ranges).every(([key,[min,max]])=>Number.isFinite(object[key])&&object[key]>=min&&object[key]<=max) &&
    ['pitch','roll'].every(key=>!(key in object)||(Number.isFinite(object[key])&&Math.abs(object[key])<=Math.PI*2)) &&
    (!('hue' in object)||(Number.isFinite(object.hue)&&object.hue>=0&&object.hue<=360)) &&
    Number.isInteger(object.member)&&object.member>=0&&object.member<50&&(FISH_MOTIONS.includes(object.motion)||object.type==='reef-crab'&&object.motion==='rest');
}
export function reefObject(type,id,values={}) {
  const object={id,type,x:0,y:FISH_TYPES.includes(type)?2:.02,z:0,scale:1,yaw:0,pitch:0,roll:0,hue:0,motion:FISH_TYPES.includes(type)?'circle':'still',speed:1,radius:3,phase:0,member:0,baseSpeed:.1,...values};
  return validReefObject(object)?object:null;
}
export function validReefLayout(layout) {
  return layout?.schema===1 && Array.isArray(layout.objects) && layout.objects.length<=MAX_REEF_OBJECTS &&
    layout.objects.every(validReefObject) && new Set(layout.objects.map(object=>object.id)).size===layout.objects.length;
}
export function readReefLayout(storage) {
  try {
    const raw=(storage??globalThis.localStorage).getItem(REEF_STORAGE_KEY);
    if(!raw)return {layout:null,problem:false};
    const layout=JSON.parse(raw);
    if(!validReefLayout(layout))return {layout:null,problem:true};
    layout.objects=layout.objects.map(object=>reefObject(object.type,object.id,object));
    return {layout,problem:false};
  } catch { return {layout:null,problem:true}; }
}
export function saveReefLayout(layout,storage) {
  if(!validReefLayout(layout))return false;
  try {(storage??globalThis.localStorage).setItem(REEF_STORAGE_KEY,JSON.stringify(layout));return true;}catch{return false;}
}
