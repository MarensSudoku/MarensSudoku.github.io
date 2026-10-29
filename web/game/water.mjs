import { ProceduralTexture } from '@babylonjs/core/Materials/Textures/Procedurals/proceduralTexture.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';

// Projects the moving sunlight pattern from above onto every lit material, so corals, rocks and fish catch it like the sand.
class CausticsPlugin extends MaterialPluginBase {
  constructor(material, caustics, level) {
    super(material, 'Caustics', 200, { CAUSTICS:false });
    this.caustics = caustics; this.level = level; this._enable(true);
  }
  getClassName() { return 'CausticsPlugin'; }
  prepareDefines(defines) { defines.CAUSTICS = !(this._material.disableLighting || this._material.unlit); }
  isReadyForSubMesh() { return this.caustics.isReady(); }
  getSamplers(samplers) { samplers.push('causticsSampler'); }
  getUniforms() { return { ubo:[{ name:'causticsLevel', size:1, type:'float' }], fragment:'uniform float causticsLevel;' }; }
  bindForSubMesh(uniformBuffer) { uniformBuffer.updateFloat('causticsLevel', this.level()); uniformBuffer.setTexture('causticsSampler', this.caustics); }
  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    // Some imported models store inverted normals, so the facing comes from the triangle itself, turned towards the camera.
    const definitions = `#ifdef CAUSTICS
uniform sampler2D causticsSampler;
float causticsLight(vec3 position, vec3 normal, vec3 eye) {
  vec3 face = normalize(cross(dFdx(position), dFdy(position)));
  face *= sign(dot(face, eye - position));
  return texture2D(causticsSampler, position.xz / 5.7).r * smoothstep(-.15, .85, abs(normal.y)) * smoothstep(-.05, .2, face.y);
}
#endif`;
    const light = 'causticsLevel*causticsLight(vPositionW,normalW,vEyePosition.xyz)';
    return this._material.getClassName() === 'PBRMaterial'
      ? { CUSTOM_FRAGMENT_DEFINITIONS:definitions, CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION:`#ifdef CAUSTICS\nfinalEmissive+=${light}*1.8*(surfaceAlbedo.rgb*.4+.6);\n#endif` }
      : { CUSTOM_FRAGMENT_DEFINITIONS:definitions, CUSTOM_FRAGMENT_BEFORE_FOG:`#ifdef CAUSTICS\ncolor.rgb+=${light}*(baseColor.rgb*vDiffuseColor.rgb*.75+.25);\n#endif` };
  }
}

// Breaks up the flat sand colour with grain, soft patches and current ripples; fine detail fades out with distance to avoid shimmer.
class SandPlugin extends MaterialPluginBase {
  constructor(material) { super(material, 'Sand', 210, { SAND:false }); this._enable(true); }
  getClassName() { return 'SandPlugin'; }
  prepareDefines(defines) { defines.SAND = true; }
  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS:`#ifdef SAND
float sandHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sandNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(sandHash(i), sandHash(i + vec2(1., 0.)), f.x), mix(sandHash(i + vec2(0., 1.)), sandHash(i + vec2(1., 1.)), f.x), f.y);
}
vec3 sandTone(vec2 p) {
  float detail = 1. - smoothstep(.02, .12, length(fwidth(p)));
  float patches = sandNoise(p * .18) * .6 + sandNoise(p * .55) * .4;
  float ripple = sin(dot(p, vec2(.95, .32)) * 9. + sandNoise(p * .7) * 3.);
  float grain = (sandHash(floor(p * 48.)) - .5) * detail;
  float glint = step(.985, sandHash(floor(p * 31.))) * detail;
  float tone = 1. + (patches - .5) * .14 + ripple * .05 * (.4 + .6 * detail) + grain * .12;
  return vec3(tone) * mix(vec3(.97, .99, 1.02), vec3(1.04, 1.01, .95), patches) + glint * .35;
}
#endif`,
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE:'#ifdef SAND\nbaseColor.rgb *= sandTone(vPositionW.xz);\n#endif',
    };
  }
}

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
  float edge = 1.0-smoothstep(.008,.05,second-first);
  float halo = (1.0-smoothstep(.02,.2,second-first))*.38;
  gl_FragColor=vec4(vec3(edge*.9+halo),1.0);
}`;

export function createWater(scene, sandMaterial, mobile) {
  const caustics = new ProceduralTexture('moving-sunlight', mobile ? 256 : 512, { fragmentSource:CAUSTICS }, scene);
  caustics.setFloat('waterTime', 0); caustics.uScale = 28; caustics.vScale = 28; caustics.getAlphaFromRGB = true;
  let causticsLevel = .42;
  const addCaustics = material => { if (!material.pluginManager?.getPlugin('Caustics')) new CausticsPlugin(material, caustics, () => causticsLevel); };
  scene.materials.forEach(addCaustics); scene.onNewMaterialAddedObservable.add(addCaustics);
  new SandPlugin(sandMaterial);

  const surface = CreateGround('water-surface', { width:160, height:160 }, scene);
  surface.position.y = 8;
  const surfaceMaterial = new StandardMaterial('surface-ripples', scene);
  surfaceMaterial.disableLighting = true; surfaceMaterial.backFaceCulling = false;
  surfaceMaterial.emissiveColor = new Color3(.9,1,1); surfaceMaterial.emissiveTexture = caustics;
  surfaceMaterial.opacityTexture = caustics; surfaceMaterial.alpha = .7; surfaceMaterial.fogEnabled = false;
  surface.material = surfaceMaterial; surface.isPickable = false;

  // Each ray is a band of fine streaks; the streaks drift sideways with the waves while the soft outline stays put.
  // Cloning a DynamicTexture leaves it blank, so every ray draws its own small streak texture.
  const streaks = () => {
  const streakTexture = new DynamicTexture('sunbeam-streaks', { width:128, height:4 }, scene, false), streakContext = streakTexture.getContext(), streakPixels = streakContext.createImageData(128,4);
  for (let x=0;x<128;x++) {
    const u = x/128, light = .25+.75*Math.max(0, Math.sin(u*Math.PI*6)*.6+Math.sin(u*Math.PI*14+1.3)*.4) ** 2;
    for (let y=0;y<4;y++) streakPixels.data.set([225,248,255,Math.round(255*light)],(y*128+x)*4);
  }
  streakContext.putImageData(streakPixels,0,0); streakTexture.hasAlpha = true; streakTexture.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE; streakTexture.update();
  return streakTexture;
  };
  const shaftTexture = new DynamicTexture('sunbeam-outline', { width:64, height:256 }, scene, false);
  const context = shaftTexture.getContext(), pixels = context.createImageData(64,256);
  for (let y=0;y<256;y++) for (let x=0;x<64;x++) {
    const edge = Math.sin(Math.PI*x/63) ** 2, fade = Math.sin(Math.PI*Math.min(1,y/235)) ** .7 * (1-y/255*.45);
    pixels.data.set([255,255,255,Math.round(255*edge*fade)],(y*64+x)*4);
  }
  context.putImageData(pixels,0,0); shaftTexture.hasAlpha = true; shaftTexture.update();
  // A far backdrop brightens the haze towards the sunlit surface, like light falling in from above.
  const glow = new DynamicTexture('haze-glow', { width:128, height:128 }, scene, false), glowContext = glow.getContext(), glowPixels = glowContext.createImageData(128,128);
  for (let y=0;y<128;y++) for (let x=0;x<128;x++) {
    const light = Math.max(0, 1-Math.hypot((x-63.5)/80, y/118)) ** 1.6;
    glowPixels.data.set([Math.round(51+light*150),Math.round(179+light*70),Math.round(219+light*36),255],(y*128+x)*4);
  }
  glowContext.putImageData(glowPixels,0,0); glow.update();
  const backdrop = CreatePlane('haze-backdrop', { width:260, height:110 }, scene);
  backdrop.position.set(0,30,95); backdrop.isPickable = false;
  const backdropMaterial = new StandardMaterial('haze-light', scene);
  backdropMaterial.disableLighting = true; backdropMaterial.fogEnabled = false; backdropMaterial.emissiveTexture = glow;
  backdrop.material = backdropMaterial;
  const rays = [];
  const rayCount = mobile ? 7 : 12;
  for (let i=0;i<rayCount;i++) {
    const bottomX = -18+i*36/(rayCount-1)+Math.sin(i*2.3)*1.5, height = 22, angle = Math.atan(bottomX*.7/height);
    const ray = CreatePlane('sunbeam-'+i, { width:2.4+i%3*1.1, height }, scene);
    ray.position.set(bottomX*.65,-2,3+(i*7)%5*4); ray.rotation.z = angle; ray.metadata = { angle };
    const material = new StandardMaterial('sunbeam-light-'+i, scene);
    material.disableLighting = true; material.backFaceCulling = false; material.disableDepthWrite = true; material.fogEnabled = false;
    material.emissiveColor = new Color3(.62,.9,1); material.diffuseTexture = streaks(); material.useAlphaFromDiffuseTexture = true;
    material.opacityTexture = shaftTexture; material.alphaMode = Constants.ALPHA_ADD; material.alpha = .22;
    ray.material = material; ray.isPickable = false; rays.push(ray);
  }
  return {
    update(time, dark) {
      caustics.setFloat('waterTime',time); causticsLevel = dark ? .12 : .42;
      // The surface pattern travels like waves; the ray streaks follow the same drift and flicker with it.
      caustics.uOffset = time*.006; caustics.vOffset = time*.004;
      for (let i=0;i<rays.length;i++) {
        rays[i].rotation.z = rays[i].metadata.angle+Math.sin(time*.12+i)*.02;
        rays[i].material.diffuseTexture.uOffset = time*.03+Math.sin(time*.45+i*1.3)*.08;
        rays[i].material.alpha = dark ? .03 : .2+.1*Math.sin(time*.9+i*1.7)*Math.sin(time*.41+i);
      }
      surfaceMaterial.alpha = dark ? .06 : .42; backdropMaterial.alpha = dark ? .2 : 1;
    },
  };
}
