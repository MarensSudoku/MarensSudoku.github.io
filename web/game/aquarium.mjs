import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { MorphTarget } from '@babylonjs/core/Morph/morphTarget.js';
import { MorphTargetManager } from '@babylonjs/core/Morph/morphTargetManager.js';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import '@babylonjs/loaders/glTF/2.0/index.js';
import { swimPose, schoolPose, tailWeight, swayWeight } from './swimming.mjs';
import { createWater } from './water.mjs';

export async function createAquarium(canvas) {
  const response = await fetch(new URL('../assets/models/aquarium.json', import.meta.url));
  if (!response.ok) throw new Error('Aquarium manifest unavailable');
  const models = await response.json();
  if (!models.reef || !models.fish?.length) { canvas.dataset.status = 'awaiting-models'; return null; }
  const mobile = matchMedia('(max-width:700px), (pointer:coarse)').matches;
  let engine;
  try {
    engine = new Engine(canvas, true, { alpha:false, stencil:false, preserveDrawingBuffer:false, powerPreference:'low-power' });
    engine.setHardwareScalingLevel(mobile ? 1 : 1 / Math.min(devicePixelRatio, 1.5));
    const scene = new Scene(engine);
    scene.clearColor = new Color4(.08,.62,.8,1);
    scene.fogMode = Scene.FOGMODE_LINEAR; scene.fogStart = 18; scene.fogEnd = 44; scene.fogColor = new Color3(.08,.62,.8);
    scene.skipPointerMovePicking = true; scene.autoClear = true;
    const camera = new FreeCamera('reef-camera', new Vector3(0, 3.8, -12), scene);
    camera.setTarget(new Vector3(0, 2.2, 8)); camera.fov = 1.0; camera.minZ = 0.1; camera.maxZ = 65;
    const sky = new HemisphericLight('water-light', new Vector3(0, 1, -0.4), scene);
    sky.intensity = .95; sky.groundColor = new Color3(.32,.55,.6);
    const sun = new DirectionalLight('sunlight', new Vector3(.35,-1,.45), scene); sun.intensity = .85; sun.position.set(-7,12,-8);
    const shadows = new ShadowGenerator(mobile ? 512 : 1024, sun);
    shadows.useBlurExponentialShadowMap = true; shadows.blurKernel = 20; shadows.setDarkness(0.35);
    const sand = CreateGround('white-sand', { width:160, height:160, subdivisions:80, updatable:true }, scene);
    const sandPositions = sand.getVerticesData(VertexBuffer.PositionKind), sandNormals = [];
    for (let i=0;i<sandPositions.length;i+=3) sandPositions[i+1] = Math.sin(sandPositions[i]*.7+sandPositions[i+2]*.4)*.045;
    VertexData.ComputeNormals(sandPositions,sand.getIndices(),sandNormals);
    sand.updateVerticesData(VertexBuffer.PositionKind,sandPositions); sand.updateVerticesData(VertexBuffer.NormalKind,sandNormals);
    const sandMaterial = new StandardMaterial('sand', scene);
    sandMaterial.diffuseColor = new Color3(.5,.56,.53); sandMaterial.specularColor = Color3.Black(); sand.material = sandMaterial;
    sand.isPickable = false; sand.receiveShadows = true;
    const water = createWater(scene,sandMaterial,mobile), scenery = [], swaying = [];
    let framing = 1;

    async function model(spec, size, bottom) {
      // Models ship as uncompressed GLB so the loader never needs remote decoders.
      const imported = await ImportMeshAsync(new URL('../assets/models/' + spec.file, import.meta.url).href, scene);
      const source = new TransformNode('source-' + spec.file, scene);
      for (const mesh of imported.meshes) if (!mesh.parent) mesh.parent = source;
      source.rotation.y = spec.yaw || 0;
      const bounds = source.getHierarchyBoundingVectors(true);
      const extent = bounds.max.subtract(bounds.min), scale = size / Math.max(extent.x, extent.y, extent.z);
      if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid aquarium model bounds');
      source.scaling.setAll(scale);
      source.position.set(-(bounds.min.x + bounds.max.x) * scale / 2, -(bottom ? bounds.min.y : (bounds.min.y + bounds.max.y) / 2) * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
      const root = new TransformNode(spec.file, scene);
      const meshes = imported.meshes.filter(mesh => mesh.getTotalVertices() > 0);
      const matrices = meshes.map(mesh => mesh.computeWorldMatrix(true).clone());
      meshes.forEach((mesh, i) => {
        mesh.bakeTransformIntoVertices(matrices[i]); mesh.parent = root;
        mesh.position.setAll(0); mesh.scaling.setAll(1); mesh.rotation.setAll(0); mesh.rotationQuaternion = null;
        mesh.isPickable = false;
        if (mesh.material) {
          mesh.material.backFaceCulling = false;
          if (spec.file === 'reef-ledge.glb') { mesh.material.albedoColor = new Color3(.38,.58,.64); mesh.material.roughness = 1; }
        }
        if (spec.file !== 'reef-ledge.glb') {
          const positions = mesh.getVerticesData(VertexBuffer.PositionKind), normals = [], shared = new Map(), keys = [];
          VertexData.ComputeNormals(positions,mesh.getIndices(),normals);
          for (let v=0;v<positions.length;v+=3) {
            const key = `${Math.round(positions[v]*10000)},${Math.round(positions[v+1]*10000)},${Math.round(positions[v+2]*10000)}`;
            keys.push(key); const sum = shared.get(key) || [0,0,0];
            for (let n=0;n<3;n++) sum[n] += normals[v+n]; shared.set(key,sum);
          }
          for (let v=0;v<positions.length;v+=3) {
            const sum = shared.get(keys[v/3]), length = Math.hypot(...sum) || 1;
            for (let n=0;n<3;n++) normals[v+n] = sum[n]/length;
          }
          mesh.setVerticesData(VertexBuffer.NormalKind,normals);
        }
        mesh.refreshBoundingInfo(); mesh.computeWorldMatrix(true);
      });
      source.dispose();
      imported.animationGroups.forEach(group => group.dispose());
      root.metadata = { height:root.getHierarchyBoundingVectors(true).max.y };
      return root;
    }

    function bend(root, strength, kind) {
      const bounds = root.getHierarchyBoundingVectors(true);
      for (const mesh of root.getChildMeshes()) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        const manager = new MorphTargetManager(scene); manager.enableNormalMorphing = false;
        for (const sign of [-1,1]) {
          const target = new MorphTarget('bend-'+sign,0,scene), bent = Float32Array.from(positions);
          for (let i=0;i<bent.length;i+=3) {
            if (kind === 'tail') bent[i+2] += sign*strength*tailWeight(bent[i],bounds.min.x,bounds.max.x);
            else if (kind === 'crab') {
              const leg = (1-swayWeight(bent[i+1],bounds.min.y,bounds.max.y))*Math.min(1,Math.abs(bent[i])*5);
              bent[i+1] += sign*strength*leg*Math.sin(bent[i]*8+bent[i+2]*5);
            } else {
              const base = kind === 'anemone' ? bounds.min.y+(bounds.max.y-bounds.min.y)*.55 : bounds.min.y;
              const weight = swayWeight(bent[i+1],base,bounds.max.y);
              bent[i] += sign*strength*weight;
              bent[i+2] += sign*strength*.4*weight*Math.sin(bent[i]*3);
            }
          }
          target.setPositions(bent); manager.addTarget(target);
        }
        mesh.morphTargetManager = manager;
      }
    }
    function place(template,name,x,y,z,size=1,yaw=0,moving=false) {
      const node = template.clone(name); node.setEnabled(true); node.position.set(x,y,z); node.scaling.setAll(size); node.rotation.y = yaw;
      const managers = node.getChildMeshes().filter(mesh=>mesh.morphTargetManager).map(mesh=> {
        mesh.morphTargetManager = mesh.morphTargetManager.clone(); return mesh.morphTargetManager;
      });
      scenery.push({node,x});
      if (moving) swaying.push({managers,phase:scenery.length*.9});
      else node.getChildMeshes().forEach(mesh=>shadows.addShadowCaster(mesh,false));
      return node;
    }
    const reef = await model(models.reef,4.8,true); reef.setEnabled(false);
    const rock = await model(models.rock,models.rock.size,true); rock.setEnabled(false);
    const ledges=[[-7.2,0,-1,.85,.15],[7.2,0,0,.9,2.8],[-8,0,11,1,.4],[8.5,0,13,1.1,2.5],[-12,0,27,1.3,.3],[12,0,28,1.4,2.9]];
    ledges.forEach(([x,y,z,size,yaw],i)=> {
      place(rock,'ledge-'+i,x,y,z,size,yaw);
      place(reef,'reef-'+i,x*.92,y+rock.metadata.height*size*.72,z-.25,.72+size*.1,i*1.4);
    });
    const coralSites = [
      [[-6.5,2.7,0,1.2],[6.5,2.4,2,1.2],[-8,2.7,12,1],[8.5,3,14,1.1]],
      [[-4.8,.02,-2,1],[5,.02,-1,1],[-7,2.5,13,1],[7,2.4,12,1.1]],
      [[-6,1.4,-1,1.1],[6.2,1.3,1,1.2],[-5.8,.1,8,1.3],[6,.1,10,1.3]],
      [[-4.6,.01,-4,1],[4.9,.01,-3,1.1],[-6,.01,7,1],[6.2,.01,9,1.3]],
      [[-6,.01,-4,1.15],[6,.01,-4,1.2],[-8,2,13,.9],[8.5,2.5,15,1]]
    ];
    const coralTemplates=[];
    for (let i=0;i<models.corals.length;i++) {
      const spec = models.corals[i], template = await model(spec,spec.size,true);
      if(spec.sway) bend(template,spec.sway,'plant'); template.setEnabled(false);
      coralTemplates.push(template);
      coralSites[i].forEach(([x,y,z,size],j)=>place(template,`coral-${i}-${j}`,x,y,z,size,j*.7,Boolean(spec.sway)));
    }
    ledges.forEach(([x,y,z,size],i)=> {
      const top=y+rock.metadata.height*size*.72;
      for(let j=0;j<2;j++) {
        const index=(i+j*2)%coralTemplates.length;
        place(coralTemplates[index],`ledge-growth-${i}-${j}`,x+(j ? .7 : -.7),top,z+.3,.85,i*.6,Boolean(models.corals[index].sway));
      }
    });
    for(let i=0;i<models.plants.length;i++) {
      const spec=models.plants[i], template=await model(spec,spec.size,true); bend(template,spec.sway,'plant'); template.setEnabled(false);
      [[-5.6,.02,-.5],[5.4,.02,3],[-7.6,rock.metadata.height*.65,11],[8,rock.metadata.height*.72,15]].forEach(([x,y,z],j)=>place(template,`plant-${i}-${j}`,x+i*.7,y,z+i*1.1,.85+j*.08,j*1.4,true));
    }
    const anemone=await model(models.anemone,models.anemone.size,true); bend(anemone,models.anemone.sway,'anemone'); anemone.setEnabled(false);
    [[-4.4,.02,1],[4.3,.02,4],[-6.5,2.4,10]].forEach(([x,y,z],i)=>place(anemone,'anemone-'+i,x,y,z,1,i,true));
    const crab = await model(models.crab,models.crab.size,true); bend(crab,.035,'crab');
    const crabManagers = crab.getChildMeshes().map(mesh=>mesh.morphTargetManager);
    shadows.getShadowMap().refreshRate = 0;
    const fish = [];
    for (let species = 0; species < models.fish.length; species++) {
      const spec=models.fish[species], school=Boolean(spec.school);
      const template = await model(spec,school ? (mobile ? .36 : .46) : .85 + species*.06,false);
      bend(template,school ? .045 : .085,'tail'); template.setEnabled(false);
      for (let i = 0; i < (school ? (mobile ? 8 : 12) : (mobile ? 2 : 3)); i++) {
        const body=template.clone(`fish-${species}-${i}`); body.setEnabled(true);
        const managers=body.getChildMeshes().map(mesh=> { mesh.morphTargetManager=mesh.morphTargetManager.clone();return mesh.morphTargetManager; });
        fish.push({ body, managers, school, member:i, phase:school ? species*1.3 : species*2+i*1.8, speed:school ? .065+species*.004 : .08+species*.014, radius:school ? 4.5 : 3.6+i*.6, depth:school ? 9+(species-4)*4 : 1+species*1.2, height:school ? 4+(species-4)*1.3 : 1.6+species*.55+i*.35 });
      }
    }
    let reduced = false, dark = false, time = 0, last = performance.now();
    function render(now = performance.now(), force = false) {
      if (!force && now - last < 1000 / 30) return;
      const delta = Math.min((now - last) / 1000, 0.08); last = now;
      if (!reduced) time += delta;
      for (const animal of fish) {
        const pose = animal.school ? schoolPose(time,animal) : swimPose(time, animal);
        animal.body.position.set(pose.x*framing, pose.y, pose.z); animal.body.rotation.y = pose.yaw;
        const wave = Math.sin(time * 7 + animal.phase + animal.member*.65);
        for (const manager of animal.managers) { manager.getTarget(0).influence = Math.max(0,-wave); manager.getTarget(1).influence = Math.max(0,wave); }
      }
      for(const plant of swaying) {
        const wave=Math.sin(time*.75+plant.phase);
        for(const manager of plant.managers) {manager.getTarget(0).influence=Math.max(0,-wave);manager.getTarget(1).influence=Math.max(0,wave);}
      }
      crab.position.set((-2+Math.sin(time*.16)*1.4)*framing,.025, -.5+Math.cos(time*.11)*.5);
      for(const manager of crabManagers) {const wave=Math.sin(time*5);manager.getTarget(0).influence=Math.max(0,-wave);manager.getTarget(1).influence=Math.max(0,wave);}
      water.update(time,dark);
      scene.render();
    }
    function drawOnce() { engine.beginFrame(); render(performance.now(),true); engine.endFrame(); }
    function resume() {
      engine.stopRenderLoop(render); last = performance.now() - 40;
      if (document.hidden) return;
      drawOnce();
      if (!reduced) engine.runRenderLoop(render);
    }
    function resize() {
      engine.resize(); framing=Math.min(1,Math.max(.58,engine.getAspectRatio(camera)/1.6));
      for(const item of scenery) item.node.position.x=item.x*framing;
      shadows.getShadowMap().resetRefreshCounter();
      if (!document.hidden) drawOnce();
    }
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', resume);
    engine.onContextLostObservable.add(() => { canvas.dataset.status = 'context-lost'; });
    engine.onContextRestoredObservable.add(() => { canvas.dataset.status = 'ready'; resume(); });
    await scene.whenReadyAsync();
    resize(); resume(); canvas.dataset.status = 'ready';
    return {
      updateOptions(options) {
        if (dark !== options.dark) { dark = options.dark; sky.intensity = dark ? .3 : .95; sun.intensity = dark ? .18 : .85; }
        if (reduced !== options.reduced) { reduced = options.reduced; resume(); }
        else if (reduced && !document.hidden) drawOnce();
      },
      dispose() { window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', resume); engine.dispose(); canvas.dataset.status = 'disposed'; },
    };
  } catch (error) { engine?.dispose(); canvas.dataset.status = 'unavailable'; throw error; }
}
