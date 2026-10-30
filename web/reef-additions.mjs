export const REEF_ADDITIONS = [
  {"id":"seahorse","name":["Seepferdchen","Seahorse"],"kind":"swim","size":1.2,"yaw":1.5707963267948966,"unlock":"first","rigged":true},
  {"id":"treasure-chest","name":["Piratenschatz","Pirate treasure"],"kind":"prop","size":1.8,"yaw":3.141592653589793,"unlock":"stars","rigged":true},
  {"id":"shipwreck","name":["Altes Schiffswrack","Old shipwreck"],"kind":"prop","size":4.2,"yaw":3.141592653589793,"unlock":"magic"},
  {"id":"nudibranch","name":["Blauweiße Nacktschnecke","Blue and white nudibranch"],"kind":"walk","size":0.9,"yaw":1.5707963267948966,"unlock":"variety"},
  {"id":"sea-turtle","name":["Meeresschildkröte","Sea turtle"],"kind":"swim","size":1.8,"yaw":1.5707963267948966,"unlock":"crown","rigged":true},
  {"id":"octopus","name":["Krake","Octopus"],"kind":"walk","size":1.7,"yaw":1.5707963267948966,"unlock":"direct","rigged":true},
  {"id":"sea-snail","name":["Bunte Meeresschnecke","Colourful sea snail"],"kind":"walk","size":0.8,"yaw":1.5707963267948966,"unlock":"patience"},
  {"id":"spiny-lobster","name":["Languste","Spiny lobster"],"kind":"walk","size":1.6,"yaw":1.5707963267948966,"unlock":"trails","rigged":true},
  {"id":"cleaner-shrimp","name":["Putzergarnele","Cleaner shrimp"],"kind":"walk","size":0.8,"yaw":1.5707963267948966,"unlock":"reefkeeper"},
  {"id":"pistol-shrimp","name":["Pistolenkrebs","Pistol shrimp"],"kind":"walk","size":0.85,"yaw":1.5707963267948966,"unlock":"snap","rigged":true},
  {"id":"starfish","name":["Seestern","Starfish"],"kind":"prop","size":1.05,"yaw":3.141592653589793,"unlock":"starfinder","pitch":1.5707963267948966,"rigged":true},
  {"id":"manta-ray","name":["Mantarochen","Manta ray"],"kind":"swim","size":2.8,"yaw":1.5707963267948966,"unlock":"flow","rigged":true},
  {"id":"jellyfish","name":["Ohrenqualle","Moon jelly"],"kind":"swim","size":1.6,"yaw":1.5707963267948966,"unlock":"drift"},
];
export const REEF_REWARDS = REEF_ADDITIONS.filter(item=>item.unlock);
export const canAddReefType = (type,unlocked=[]) => {
  const item=REEF_ADDITIONS.find(item=>item.id===type);
  return !item?.unlock||unlocked.includes(item.unlock);
};
