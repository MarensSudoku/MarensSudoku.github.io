import { ProceduralTexture } from '@babylonjs/core/Materials/Textures/Procedurals/proceduralTexture.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';

const CAUSTICS = `precision highp float;
varying vec2 vUV;
uniform float waterTime;
vec2 seed(vec2 p) {
  p = mod(p, 6.0);
  return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}
void main() {
  vec2 p = vUV*6.0 + .48*vec2(sin(vUV.y*12.566+waterTime*.27),cos(vUV.x*12.566+waterTime*.23));
  p += .16*vec2(sin(vUV.x*18.849-waterTime*.16),cos(vUV.y*18.849+waterTime*.19));
  vec2 cell = floor(p), local = fract(p);
  float first = 8.0, second = 8.0;
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) {
    vec2 neighbour = vec2(float(x),float(y));
    vec2 random = seed(cell+neighbour);
    vec2 point = .5+.27*sin(waterTime*.35+6.283*random);
    float distance = length(neighbour+point-local);
    if (distance<first) { second=first;first=distance; } else second=min(second,distance);
  }
  float edge = 1.0-smoothstep(.012,.065,second-first);
  float halo = (1.0-smoothstep(.02,.16,second-first))*.2;
  gl_FragColor=vec4(vec3(edge*.8+halo),1.0);
}`;

export function createWater(scene, sandMaterial, mobile) {
  const caustics = new ProceduralTexture('moving-sunlight', mobile ? 256 : 512, { fragmentSource:CAUSTICS }, scene);
  caustics.setFloat('waterTime', 0); caustics.uScale = 28; caustics.vScale = 28; caustics.getAlphaFromRGB = true; caustics.level = .18;
  sandMaterial.emissiveTexture = caustics;
  sandMaterial.emissiveColor = Color3.Black();

  const surface = CreateGround('water-surface', { width:160, height:160 }, scene);
  surface.position.y = 8;
  const surfaceMaterial = new StandardMaterial('surface-ripples', scene);
  surfaceMaterial.disableLighting = true; surfaceMaterial.backFaceCulling = false;
  surfaceMaterial.emissiveColor = new Color3(.72,.95,1); surfaceMaterial.emissiveTexture = caustics;
  surfaceMaterial.opacityTexture = caustics; surfaceMaterial.alpha = .3;
  surface.material = surfaceMaterial; surface.isPickable = false;

  const shaftTexture = new DynamicTexture('sunbeam-gradient', { width:64, height:256 }, scene, false);
  const context = shaftTexture.getContext(), pixels = context.createImageData(64,256);
  for (let y=0;y<256;y++) for (let x=0;x<64;x++) {
    const offset = (y*64+x)*4;
    const edge = Math.sin(Math.PI*x/63) ** 3, fade = Math.sin(Math.PI*y/255) ** .7;
    pixels.data.set([210,245,255,Math.round(255*edge*fade)],offset);
  }
  context.putImageData(pixels,0,0); shaftTexture.hasAlpha = true; shaftTexture.update();
  const rays = [];
  const rayCount = mobile ? 5 : 8;
  for (let i=0;i<rayCount;i++) {
    const bottomX = -12+i*24/(rayCount-1), angle = Math.asin(bottomX/18);
    const ray = CreatePlane('sunbeam-'+i, { width:1.2+i%3*.45, height:18 }, scene);
    ray.position.set(bottomX*.5,4,6+i%3*2); ray.rotation.z = angle; ray.metadata = { angle };
    const material = new StandardMaterial('sunbeam-light-'+i, scene);
    material.disableLighting = true; material.backFaceCulling = false; material.disableDepthWrite = true;
    material.emissiveColor = new Color3(.7,.94,1); material.diffuseTexture = shaftTexture;
    material.useAlphaFromDiffuseTexture = true; material.alpha = .14;
    ray.material = material; ray.isPickable = false; rays.push(ray);
  }
  return {
    update(time, dark) {
      caustics.setFloat('waterTime',time);
      for (let i=0;i<rays.length;i++) {
        rays[i].rotation.z = rays[i].metadata.angle+Math.sin(time*.12+i)*.025;
        rays[i].material.alpha = (dark ? .012 : .23)+Math.sin(time*.35+i)*.025;
      }
      surfaceMaterial.alpha = dark ? .06 : .18;
    },
  };
}
