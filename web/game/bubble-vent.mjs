import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { FluidRenderingObject } from '@babylonjs/core/Rendering/fluidRenderer/fluidRenderingObject.js';
import '@babylonjs/core/Rendering/fluidRenderer/fluidRenderer.js';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture.js';
import { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { PostProcess } from '@babylonjs/core/PostProcesses/postProcess.js';

export function createBubbleVent(scene) {
  const root = new TransformNode('bubble-vent-template', scene);
  const stone = new StandardMaterial('air-stone', scene);
  stone.diffuseColor = new Color3(.32,.52,.52); stone.specularColor = Color3.Black();
  const base = CreateCylinder('air-stone-base', {height:.16,diameterTop:.86,diameterBottom:1,tessellation:24}, scene);
  base.position.y = .08; base.parent = root; base.material = stone;
  const pore = new StandardMaterial('air-stone-pores', scene);
  pore.diffuseColor = new Color3(.1,.27,.3); pore.specularColor = Color3.Black();
  for (let i=0;i<9;i++) {
    const hole = CreateCylinder('air-stone-pore', {height:.008,diameter:.055,tessellation:8}, scene);
    const angle=i*Math.PI*2/8, radius=i===8?0:.29;
    hole.position.set(Math.cos(angle)*radius,.163,Math.sin(angle)*radius); hole.parent=root; hole.material=pore;
  }
  root.metadata = {type:'bubble-vent',height:.17}; root.setEnabled(false);
  return root;
}

export function createVentBubbles(scene) {
  let system, sky, fluid, nodes=[], next=0, failed=false;
  const sources=new WeakMap();
  function stop() {
    if (!system) return;
    scene.disableFluidRenderer(); system.dispose(); sky?.dispose(); system=null;
    PostProcess.RegisterShaderCodeProcessing('FluidRendering');
  }
  function start() {
    FluidRenderingObject.UsePerParticleSizeAttribute = true;
    // Air inside water bends light in the opposite direction to water inside air.
    PostProcess.RegisterShaderCodeProcessing('FluidRendering', {
      processFinalCode:(_name,type,code) => type==='fragment'?code.replace('#define ETA 1.0/IOR','#define ETA IOR'):code,
    });
    system = new ParticleSystem('reef-air-bubbles', 1000, scene);
    system.particleTexture = RawTexture.CreateRGBATexture(new Uint8Array([255,255,255,255]),1,1,scene,false,false);
    system.emitter = Vector3.Zero(); system.minSize=.025; system.maxSize=.16;
    system.minLifeTime=6; system.maxLifeTime=10; system.updateSpeed=1/60;
    system.minEmitPower=.9; system.maxEmitPower=1.4; system.gravity=new Vector3(0,.09,0);
    system.color1=system.color2=new Color4(1,1,1,1); system.colorDead=new Color4(1,1,1,0);
    system.startPositionFunction=(_world,position,particle)=>{
      const node=nodes[next++%nodes.length];
      const local=new Vector3((Math.random()-.5)*.45,.18,(Math.random()-.5)*.45);
      Vector3.TransformCoordinatesToRef(local,node.computeWorldMatrix(true),position);
      sources.set(particle,node);
      // Babylon initializes particle scale immediately after the emitter callback.
      const size=node.scaling.x,wobble=Math.sin(particle.id);
      system.minScaleX=system.maxScaleX=size*(1+wobble*.1);
      system.minScaleY=system.maxScaleY=size*(.8-wobble*.1);
    };
    system.startDirectionFunction=(_world,direction)=>direction.set((Math.random()-.5)*.1,1,(Math.random()-.5)*.1);
    const update=system.updateFunction;
    system.updateFunction=particles=>{
      update.call(system,particles);
      for (const particle of particles) {
        const wobble=Math.sin(particle.age*9+particle.id);
        const size=sources.get(particle)?.scaling.x??1;
        particle.scale.set(size*(1+wobble*.1),size*(.8-wobble*.1));
        particle.direction.x=Math.sin(particle.age*6+particle.id)*.09;
      }
    };
    const faces=[[190,232,239],[190,232,239],[250,255,255],[104,164,178],[179,225,235],[179,225,235]];
    sky=new RawCubeTexture(scene,faces.map(color=>new Uint8Array(color)),1,Constants.TEXTUREFORMAT_RGB,Constants.TEXTURETYPE_UNSIGNED_BYTE,false,false);
    fluid=scene.enableFluidRenderer().addParticleSystem(system).targetRenderer;
    fluid.environmentMap=sky; fluid.fluidColor=new Color3(.94,.99,1);
    fluid.density=.025; fluid.refractionStrength=.07; fluid.fresnelClamp=.85; fluid.specularPower=100;
    fluid.dirLight=new Vector3(.3,-1,.4); fluid.minimumThickness=.001;
    fluid.depthMapSize=512; fluid.thicknessMapSize=256;
    fluid.blurDepthFilterSize=3; fluid.blurDepthNumIterations=1; fluid.enableBlurThickness=false;
    system.start();
  }
  return {
    update(entries,active) {
      nodes=entries.map(entry=>entry.node);
      if (!active||!nodes.length) {stop();return;}
      if (!system&&!failed) {try {start();} catch {stop();failed=true;}}
      if (system) system.emitRate=Math.min(180,nodes.length*28);
    },
    dispose:stop,
  };
}
