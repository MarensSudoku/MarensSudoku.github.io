export const REEF_ADDITIONS = [
  {"id":"seahorse","kind":"swim","size":1.2,"yaw":1.5707963267948966,"unlock":"first","rigged":true},
  {"id":"treasure-chest","kind":"prop","size":1.8,"yaw":3.141592653589793,"unlock":"stars","rigged":true},
  {"id":"shipwreck","kind":"prop","size":4.2,"yaw":3.141592653589793,"unlock":"magic"},
  {"id":"nudibranch","kind":"walk","size":0.9,"yaw":1.5707963267948966,"unlock":"variety"},
  {"id":"sea-turtle","kind":"swim","size":1.8,"yaw":1.5707963267948966,"unlock":"crown","rigged":true},
  {"id":"octopus","kind":"walk","size":1.7,"yaw":1.5707963267948966,"unlock":"direct","rigged":true},
  {"id":"sea-snail","kind":"walk","size":0.8,"yaw":1.5707963267948966,"unlock":"patience"},
  {"id":"spiny-lobster","kind":"walk","size":1.6,"yaw":1.5707963267948966,"unlock":"trails","rigged":true},
  {"id":"cleaner-shrimp","kind":"walk","size":0.8,"yaw":1.5707963267948966,"unlock":"reefkeeper"},
  {"id":"pistol-shrimp","kind":"walk","size":0.85,"yaw":1.5707963267948966,"unlock":"snap","rigged":true},
  {"id":"starfish","kind":"prop","size":1.05,"yaw":3.141592653589793,"unlock":"starfinder","pitch":1.5707963267948966,"rigged":true},
  {"id":"manta-ray","kind":"swim","size":2.8,"yaw":1.5707963267948966,"unlock":"flow","rigged":true},
  {"id":"jellyfish","kind":"swim","size":1.6,"yaw":1.5707963267948966,"unlock":"drift"},
];
export const REEF_REWARDS = REEF_ADDITIONS.filter(item=>item.unlock);
export const canAddReefType = (type,unlocked=[]) => {
  const item=REEF_ADDITIONS.find(item=>item.id===type);
  return !item?.unlock||unlocked.includes(item.unlock);
};
