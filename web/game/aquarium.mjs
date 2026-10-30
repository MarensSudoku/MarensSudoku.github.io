import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Plane } from '@babylonjs/core/Maths/math.plane.js';
import '@babylonjs/core/Culling/ray.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { MorphTarget } from '@babylonjs/core/Morph/morphTarget.js';
import { MorphTargetManager } from '@babylonjs/core/Morph/morphTargetManager.js';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves.js';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import '@babylonjs/loaders/glTF/2.0/index.js';
import { aquariumPose, tailWeight, swayWeight } from './swimming.mjs';
import { createWater } from './water.mjs';
import { FISH_TYPES, MAX_REEF_OBJECTS, reefObject, validReefObject, validReefLayout, readReefLayout } from '../reef-layout.mjs';

class GroundShadow extends MaterialPluginBase {
  constructor(material) {super(material,'GroundShadow',100);this._enable(true);}
  getClassName() {return 'GroundShadow';}
  getCustomCode(stage) {
    return stage==='vertex'?{CUSTOM_VERTEX_UPDATE_WORLDPOS:'float shadowHeight = worldPos.y - .055; worldPos.xyz = vec3(worldPos.x + .35 * shadowHeight, .055, worldPos.z + .45 * shadowHeight);'}:null;
  }
}

class ReefColor extends MaterialPluginBase {
  constructor(material) {super(material,'ReefColor',110);this.registerForExtraEvents=true;this._enable(true);}
  getClassName() {return 'ReefColor';}
  getUniforms() {return {ubo:[{name:'reefHue',size:1,type:'float'},{name:'reefHighlight',size:1,type:'float'}],fragment:'uniform float reefHue; uniform float reefHighlight;'};}
  hardBindForSubMesh(buffer,scene,engine,subMesh) {
    const entry=subMesh.getRenderingMesh().parent?.metadata?.reefEntry;
    buffer.updateFloat('reefHue',entry?.record.hue||0);buffer.updateFloat('reefHighlight',entry?.highlighted?1:0);
  }
  getCustomCode(stage) {
    if(stage!=='fragment')return null;
    const code={CUSTOM_FRAGMENT_DEFINITIONS:`vec3 reefColor(vec3 color) {
      if (reefHighlight > 0.) return vec3(1., .7, .05);
      if (reefHue <= 0.) return color;
      float value = max(max(color.r, color.g), color.b);
      float saturation = value > 0. ? (value - min(min(color.r, color.g), color.b)) / value : 0.;
      vec3 palette = clamp(abs(fract(reefHue / 360. + vec3(0., 2./3., 1./3.)) * 6. - 3.) - 1., 0., 1.);
      return value * mix(vec3(1.), palette, max(saturation, .45));
    }`};
    code[this._material.getClassName()==='PBRMaterial'?'CUSTOM_FRAGMENT_UPDATE_ALBEDO':'CUSTOM_FRAGMENT_UPDATE_DIFFUSE']=this._material.getClassName()==='PBRMaterial'?'surfaceAlbedo = reefColor(surfaceAlbedo);':'baseColor.rgb = reefColor(baseColor.rgb);';
    return code;
  }
}

export async function createAquarium(canvas) {
  const response = await fetch(new URL('../assets/models/aquarium.json', import.meta.url));
  if (!response.ok) throw new Error('Aquarium manifest unavailable');
  const models = await response.json();
  if (!models.reef || !models.fish?.length) { canvas.dataset.status = 'awaiting-models'; return null; }
  const mobile = matchMedia('(max-width:700px), (pointer:coarse)').matches;
  let engine;
  try {
    engine = new Engine(canvas, true, { alpha:false, stencil:true, preserveDrawingBuffer:false, powerPreference:'low-power' });
    // CPU rendering uses a lighter reef at 30 fps; desktop also halves resolution while mobile keeps native screen pixels.
    const software = /swiftshader|llvmpipe|softpipe|basic render|warp|software/i.test(engine.getGlInfo().renderer);
    engine.setHardwareScalingLevel(mobile ? 1 / devicePixelRatio : software ? 2 : 1 / Math.min(devicePixelRatio, 1.5));
    const frameBudget = 1000 / (software ? 30 : 60) - 2;
    const scene = new Scene(engine);
    scene.clearColor = new Color4(.2,.7,.86,1);
    scene.fogMode = Scene.FOGMODE_LINEAR; scene.fogStart = 16; scene.fogEnd = 100; scene.fogColor = new Color3(.2,.7,.86);
    scene.imageProcessingConfiguration.contrast = 1.1;
    scene.imageProcessingConfiguration.colorCurvesEnabled = true; scene.imageProcessingConfiguration.colorCurves = Object.assign(new ColorCurves(), { globalSaturation:28 });
    scene.skipPointerMovePicking = true; scene.autoClear = true;
    const camera = new FreeCamera('reef-camera', new Vector3(0, 3.8, -12), scene);
    camera.setTarget(new Vector3(0, 2.7, 8)); camera.fov = 1.0; camera.minZ = 0.1; camera.maxZ = 140;
    const sky = new HemisphericLight('water-light', new Vector3(0, 1, -0.4), scene);
    sky.intensity = .95; sky.groundColor = new Color3(.32,.55,.6);
    const sun = new DirectionalLight('sunlight', new Vector3(.35,-1,.45), scene); sun.intensity = .85; sun.position.set(-7,12,-8);
    const shadowMaterial = new StandardMaterial('ground-shadow',scene);
    shadowMaterial.disableLighting=true;shadowMaterial.diffuseColor=Color3.Black();shadowMaterial.emissiveColor=new Color3(.12,.18,.2);shadowMaterial.alpha=.22;shadowMaterial.backFaceCulling=false;
    // Stencil shades each sand pixel once, regardless of overlapping projected faces.
    shadowMaterial.stencil.enabled=true;shadowMaterial.stencil.func=shadowMaterial.stencil.backFunc=Constants.NOTEQUAL;
    shadowMaterial.stencil.mask=shadowMaterial.stencil.funcMask=1;
    new GroundShadow(shadowMaterial);
    const hoverGlow=new HighlightLayer('reef-hover',scene,{mainTextureRatio:1,blurHorizontalSize:2,blurVerticalSize:2});
    hoverGlow.innerGlow=false;hoverGlow.numStencilBits=2;hoverGlow.isEnabled=false;
    const sand = CreateGround('white-sand', { width:160, height:160, subdivisions:80, updatable:true }, scene);
    const sandPositions = sand.getVerticesData(VertexBuffer.PositionKind), sandNormals = [];
    for (let i=0;i<sandPositions.length;i+=3) sandPositions[i+1] = Math.sin(sandPositions[i]*.7+sandPositions[i+2]*.4)*.045;
    VertexData.ComputeNormals(sandPositions,sand.getIndices(),sandNormals);
    sand.updateVerticesData(VertexBuffer.PositionKind,sandPositions); sand.updateVerticesData(VertexBuffer.NormalKind,sandNormals);
    const sandMaterial = new StandardMaterial('sand', scene);
    sandMaterial.diffuseColor = new Color3(.5,.62,.64); sandMaterial.specularColor = Color3.Black(); sand.material = sandMaterial;
    sand.isPickable = false;
    const water = createWater(scene,sandMaterial,mobile||software), scenery = [], swaying = [];
    const templates = new Map(), objects = new Map(), fish = [];
    let framing = 1, editing = false, transformMode = 'move', selected = null, hovered = null, dragging = null, ready = false, replacing = false, selectionChanged = () => {}, beforeChange = () => {};

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
          if(!mesh.material.pluginManager.getPlugin('ReefColor'))new ReefColor(mesh.material);
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
      root.metadata = { height:root.getHierarchyBoundingVectors(true).max.y, type:spec.file.replace('.glb','') };
      templates.set(root.metadata.type,root);
      return root;
    }

    // Swaying influences cross zero constantly; keeping every target active avoids a shader switch on each crossing (clone() resets this).
    const steady = manager => { manager.optimizeInfluencers = false; return manager; };
    function addShadows(node) {
      for(const mesh of node.getChildMeshes()) {
        const shadow=mesh.clone('shadow-'+mesh.name,mesh.parent,true);
        shadow.material=shadowMaterial;shadow.morphTargetManager=mesh.morphTargetManager;
        shadow.isPickable=false;shadow.alwaysSelectAsActiveMesh=true;shadow.alphaIndex=0;
        hoverGlow.addExcludedMesh(shadow);
      }
    }
    function bend(root, strength, kind) {
      const bounds = root.getHierarchyBoundingVectors(true);
      for (const mesh of root.getChildMeshes()) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        const manager = steady(new MorphTargetManager(scene)); manager.enableNormalMorphing = false;
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
        mesh.morphTargetManager = steady(mesh.morphTargetManager.clone()); return mesh.morphTargetManager;
      });
      const sceneryItem={node,x}, entry={node,managers,scenery:sceneryItem,record:reefObject(template.metadata.type,name,{x,y,z,scale:size,yaw:Math.atan2(Math.sin(yaw),Math.cos(yaw))})};
      node.metadata={...node.metadata,reefEntry:entry};
      scenery.push(sceneryItem); objects.set(name,entry);
      if (moving) { entry.sway={managers,phase:scenery.length*.9}; swaying.push(entry.sway); }
      addShadows(node);
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
    // Distant reef pieces use the same editable records; CPU-only defaults omit their geometry.
    (software ? [] : [[-15,22,1.3,.5],[-19,34,1.6,1.2],[-13,47,1.5,2],[-25,50,2,.3],[15,24,1.4,2.4],[20,36,1.7,.9],[14,49,1.5,1.7],[26,54,2.1,2.8],[-5,62,1.3,.6],[6,68,1.4,2.2]]).forEach(([x,z,size,yaw],i)=> {
      const height=rock.metadata.height, upper=size*.75, top=height*size*.6+height*upper*.72;
      place(rock,`pillar-${i}`,x,0,z,size,yaw); place(rock,`pillar-top-${i}`,x*.98,height*size*.6,z+.3,upper,yaw+1.1);
      place(reef,`pillar-reef-${i}`,x*.96,top,z,.6+size*.12,yaw*2);
      for(let j=0;j<2;j++)place(coralTemplates[(i+j*3)%coralTemplates.length],`pillar-coral-${i}-${j}`,x+(j?1:-1)*size*.9,height*size*.6,z-.4,.9+size*.15,i+j);
    });
    for(let i=0;i<models.plants.length;i++) {
      const spec=models.plants[i], template=await model(spec,spec.size,true); bend(template,spec.sway,'plant'); template.setEnabled(false);
      [[-5.6,.02,-.5],[5.4,.02,3],[-7.6,rock.metadata.height*.65,11],[8,rock.metadata.height*.72,15]].forEach(([x,y,z],j)=>place(template,`plant-${i}-${j}`,x+i*.7,y,z+i*1.1,.85+j*.08,j*1.4,true));
      [-1,1].forEach(side=>place(template,`foreground-plant-${i}-${side}`,side*(4.15-i*.45),.02,-4.8+i*.6,.9,side<0 ? .4 : 2.6,true));
    }
    const anemone=await model(models.anemone,models.anemone.size,true); bend(anemone,models.anemone.sway,'anemone'); anemone.setEnabled(false);
    [[-4.4,.02,1],[4.3,.02,4],[-6.5,2.4,10]].forEach(([x,y,z],i)=>place(anemone,'anemone-'+i,x,y,z,1,i,true));
    [[-3.3,.02,-5],[3.5,.02,-4.5]].forEach(([x,y,z],i)=>place(anemone,'foreground-anemone-'+i,x,y,z,1.1,i*1.7,true));
    const crabTemplate = await model(models.crab,models.crab.size,true); bend(crabTemplate,.035,'crab'); crabTemplate.setEnabled(false);
    place(crabTemplate,'reef-crab',-2,.025,-.5);
    for (let species = 0; species < models.fish.length; species++) {
      const spec=models.fish[species], school=Boolean(spec.school);
      const template = await model(spec,school ? (mobile ? .36 : .46) : .85 + species*.06,false);
      bend(template,school ? .045 : .085,'tail'); template.setEnabled(false);
      for (let i = 0; i < (school ? (mobile ? 8 : 12) : (mobile ? 2 : 3)); i++) {
        const body=template.clone(`fish-${species}-${i}`); body.setEnabled(true);
        const managers=body.getChildMeshes().map(mesh=> { mesh.morphTargetManager=steady(mesh.morphTargetManager.clone());return mesh.morphTargetManager; });
        addShadows(body);
        const record=reefObject(template.metadata.type,body.name,{motion:school?'school':'circle',member:i,phase:school?species*1.3:species*2+i*1.8,baseSpeed:school?.065+species*.004:.08+species*.014,radius:school?4.5:3.6+i*.6,z:school?9+(species-4)*4:1+species*1.2,y:school?4+(species-4)*1.3:1.6+species*.55+i*.35});
        const animal={body,managers,record},entry={node:body,managers,record,animal};fish.push(animal);objects.set(record.id,entry);body.metadata={...body.metadata,reefEntry:entry};
      }
    }
    const ring=CreateTorus('selected-object',{diameter:1,thickness:.035,tessellation:32},scene);
    const ringMaterial=new StandardMaterial('selection-light',scene); ringMaterial.emissiveColor=new Color3(.7,1,1);ringMaterial.disableLighting=true;
    ring.material=ringMaterial;ring.isPickable=false;ring.setEnabled(false);
    hoverGlow.addExcludedMesh(ring);
    function snapshot() {return {schema:1,objects:[...objects.values()].map(entry=>({...entry.record}))};}
    function changing() {if(!replacing)beforeChange();}
    const defaultLayout=snapshot(), stored=readReefLayout();
    if(!validReefLayout(defaultLayout))throw new Error('Invalid default reef layout');
    function redraw() {if(ready&&!replacing&&(reduced||editing)&&!document.hidden)drawOnce();}
    function placementPose(object) {
      return FISH_TYPES.includes(object.type)||object.type==='reef-crab'?aquariumPose(time,object):object;
    }
    function updateRoot(entry) {
      const object=entry.record,pose=editing?placementPose(object):object;
      entry.node.position.set(pose.x*framing,pose.y,pose.z);entry.node.scaling.setAll(object.scale);entry.node.rotation.set(pose.pitch||0,pose.yaw,pose.roll||0);
      if(entry.scenery)entry.scenery.x=object.x;
      entry.node.getChildMeshes().forEach(mesh=>mesh.isPickable=editing&&mesh.material!==shadowMaterial);
    }
    function addRecord(object) {
      const template=templates.get(object.type), isFish=FISH_TYPES.includes(object.type);
      const moving=!isFish&&object.type!=='reef-crab'&&template.getChildMeshes().some(mesh=>mesh.morphTargetManager);
      const node=place(template,object.id,object.x,object.y,object.z,object.scale,object.yaw,moving), entry=objects.get(object.id);
      entry.record=reefObject(object.type,object.id,object);
      if(isFish) {entry.animal={body:node,managers:entry.managers,record:entry.record};fish.push(entry.animal);}
      updateRoot(entry);return entry;
    }
    function removeObject(id) {
      const entry=objects.get(id);if(!entry)return false;
      changing();
      if(hovered===id)setHovered(null);
      for(const list of [scenery,swaying,fish]) {const item=list===scenery?entry.scenery:list===swaying?entry.sway:entry.animal;const index=list.indexOf(item);if(index>=0)list.splice(index,1);}
      entry.node.dispose(false,false);entry.managers.forEach(manager=>manager.dispose());objects.delete(id);
      if(selected===id)select(null);redraw();return true;
    }
    function setLayout(layout) {
      if(!validReefLayout(layout)||!layout.objects.every(object=>templates.has(object.type)))return false;
      if(JSON.stringify(layout)!==JSON.stringify(snapshot()))changing();
      replacing=true;
      try {for(const id of [...objects.keys()])removeObject(id);layout.objects.forEach(addRecord);select(null);}
      finally {replacing=false;}
      redraw();return true;
    }
    function setHovered(id) {
      id=editing&&objects.has(id)?id:null;if(hovered===id)return;
      const previous=objects.get(hovered);if(previous)previous.highlighted=false;
      hoverGlow.removeAllMeshes();hovered=id;hoverGlow.isEnabled=Boolean(id);
      if(id)objects.get(id).highlighted=true;
      if(id)for(const mesh of objects.get(id).node.getChildMeshes())if(mesh.material!==shadowMaterial)hoverGlow.addMesh(mesh,new Color3(1,.85,.35));
      redraw();
      if(id&&!scene.isReady())scene.whenReadyAsync().then(()=>{if(hovered===id)redraw();});
    }
    function select(id) {selected=objects.has(id)?id:null;setHovered(selected);selectionChanged(selected?{...objects.get(selected).record}:null);redraw();}
    function updateSelectionRing() {
      const entry=editing&&objects.get(selected);ring.setEnabled(Boolean(entry));if(!entry)return;
      ring.position.copyFrom(entry.node.position);ring.position.y+=FISH_TYPES.includes(entry.record.type)?-templates.get(entry.record.type).metadata.height*entry.record.scale-.08:.04;
      ring.scaling.setAll(Math.max(.7,Math.min(3,templates.get(entry.record.type).metadata.height*entry.record.scale)));
    }
    const schoolFields=['x','y','z','yaw','pitch','roll','speed','radius','phase','baseSpeed'];
    function joinSchool(object) {
      const group=[...objects.values()].map(entry=>entry.record).filter(record=>record.id!==object.id&&record.type===object.type&&record.motion==='school');
      const member=Array.from({length:50},(_,i)=>i).find(i=>!group.some(record=>record.member===i));
      if(member===undefined)return false;
      if(group.length)for(const key of schoolFields)object[key]=group[0][key];
      object.member=member;return true;
    }
    function updateObject(id,patch) {
      const entry=objects.get(id);if(!entry)return false;
      const object={...entry.record,...patch,id:entry.record.id,type:entry.record.type};
      if(!validReefObject(object))return false;
      if(patch.motion==='school'&&!joinSchool(object))return false;
      if(Object.keys(object).every(key=>object[key]===entry.record[key]))return true;
      changing();
      Object.assign(entry.record,object);updateRoot(entry);
      if(object.motion==='school')for(const other of objects.values())if(other!==entry&&other.record.type===object.type&&other.record.motion==='school') {
        for(const key of schoolFields)other.record[key]=object[key];updateRoot(other);
      }
      if(selected===id)selectionChanged({...object});redraw();return true;
    }
    function pointerPosition(event) {const bounds=canvas.getBoundingClientRect();return [event.clientX-bounds.left,event.clientY-bounds.top];}
    function projectPoint(point) {
      const projected=Vector3.Project(point,Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight())),scale=engine.getHardwareScalingLevel();
      return [projected.x*scale,projected.y*scale];
    }
    function pickObject(x,y) {
      let node=scene.pick(x,y)?.pickedMesh;
      while(node){for(const entry of objects.values())if(entry.node===node)return entry;node=node.parent;}
      return null;
    }
    function rotateObject(start,angle,axis='yaw') {
      const rotation=Math.atan2(Math.sin(angle),Math.cos(angle)),before=placementPose(start),after=placementPose({...start,[axis]:rotation});
      return updateObject(start.id,{[axis]:rotation,x:Math.max(-30,Math.min(30,start.x+before.x-after.x)),y:Math.max(0,Math.min(16,start.y+before.y-after.y)),z:Math.max(-8,Math.min(80,start.z+before.z-after.z))});
    }
    function pointOnPlane(x,y,plane) {
      const ray=scene.createPickingRay(x,y,Matrix.Identity(),camera),distance=ray.intersectsPlane(plane);
      return distance===null||distance<0?null:ray.origin.add(ray.direction.scale(distance));
    }
    function pointerDown(event) {
      if(!editing||event.button!==0||!event.isPrimary)return;
      const [x,y]=pointerPosition(event);
      if(event.pointerType==='touch'&&!selected){
        dragging={pointer:event.pointerId,mode:'select'};setHovered(pickObject(x,y)?.record.id||null);
        canvas.setPointerCapture(event.pointerId);return;
      }
      const entry=objects.get(selected)||pickObject(x,y);select(entry?.record.id||null);
      if(entry){
        const plane=transformMode==='height'?new Plane(0,0,1,-entry.node.position.z):new Plane(0,1,0,-entry.node.position.y);
        const anchor=projectPoint(entry.node.position);
        dragging={id:entry.record.id,pointer:event.pointerId,mode:transformMode,x,y,anchor,record:{...entry.record},plane,point:pointOnPlane(...anchor,plane)};
        canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
      }
    }
    function pointerMove(event) {
      if(!editing)return;
      if(!dragging){if(!selected)setHovered(event.pointerType==='touch'?null:pickObject(...pointerPosition(event))?.record.id||null);return;}
      if(event.pointerId!==dragging.pointer)return;
      if(dragging.mode==='select'){setHovered(pickObject(...pointerPosition(event))?.record.id||null);return;}
      const [x,y]=pointerPosition(event),start=dragging.record;
      if(dragging.mode.startsWith('rotate')) {
        const axis=dragging.mode==='rotate-x'?'pitch':dragging.mode==='rotate-z'?'roll':'yaw';
        rotateObject(start,(start[axis]||0)+(x-dragging.x)*.012,axis);
      } else if(dragging.mode==='scale') {
        updateObject(start.id,{scale:Math.max(.25,Math.min(2.5,start.scale*Math.exp((dragging.y-y)*.008)))});
      } else {
        const point=pointOnPlane(dragging.anchor[0]+x-dragging.x,dragging.anchor[1]+y-dragging.y,dragging.plane);if(!point||!dragging.point)return;
        if(dragging.mode==='height')updateObject(start.id,{y:Math.max(0,Math.min(16,start.y+point.y-dragging.point.y))});
        else updateObject(start.id,{x:Math.max(-30,Math.min(30,start.x+(point.x-dragging.point.x)/framing)),z:Math.max(-8,Math.min(80,start.z+point.z-dragging.point.z))});
      }
    }
    function pointerUp(event) {
      if(event&&dragging&&event.pointerId!==dragging.pointer)return;
      if(dragging?.mode==='select'){
        if(event?.type==='pointerup')select(pickObject(...pointerPosition(event))?.record.id||null);
        else setHovered(null);
      }
      const pointer=dragging?.pointer;dragging=null;
      if(pointer!==undefined&&canvas.hasPointerCapture(pointer))canvas.releasePointerCapture(pointer);
      canvas.style.cursor=!editing?'':transformMode==='move'?'grab':transformMode.startsWith('rotate')?'ew-resize':'ns-resize';
    }
    function pointerLeave() {if(!selected)setHovered(null);}
    canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);
    canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
    canvas.addEventListener('pointerleave',pointerLeave);
    let reduced = false, dark = false, time = 0, last = performance.now();
    if(stored.layout)setLayout(stored.layout);
    function render(now = performance.now(), force = false) {
      if (!force && now - last < frameBudget) return; // The 2 ms slack keeps 60 Hz screens from skipping frames.
      const delta = Math.min((now - last) / 1000, 0.08); last = now;
      if (!reduced&&!editing) time += delta;
      for (const animal of fish) {
        const object=animal.record;
        const pose = aquariumPose(time,object);
        animal.body.position.set(pose.x*framing, pose.y, pose.z); animal.body.rotation.set(pose.pitch,pose.yaw,pose.roll);
        const wave = Math.sin(time * 7*object.speed + object.phase + object.member*.65);
        for (const manager of animal.managers) { manager.getTarget(0).influence = Math.max(0,-wave); manager.getTarget(1).influence = Math.max(0,wave); }
      }
      for(const plant of swaying) {
        const wave=Math.sin(time*.75+plant.phase);
        for(const manager of plant.managers) {manager.getTarget(0).influence=Math.max(0,-wave);manager.getTarget(1).influence=Math.max(0,wave);}
      }
      for(const entry of objects.values())if(entry.record.type==='reef-crab') {
        const object=entry.record;
        const pose=placementPose(object);entry.node.position.set(pose.x*framing,pose.y,pose.z);entry.node.rotation.set(pose.pitch,pose.yaw,pose.roll);
        for(const manager of entry.managers){const wave=object.motion==='rest'?0:Math.sin(time*5*object.speed);manager.getTarget(0).influence=Math.max(0,-wave);manager.getTarget(1).influence=Math.max(0,wave);}
      }
      updateSelectionRing();
      water.update(time,dark);
      scene.render();
    }
    function drawOnce() { engine.beginFrame(); render(performance.now(),true); engine.endFrame(); }
    function resume() {
      engine.stopRenderLoop(render); last = performance.now() - 40;
      if (document.hidden) return;
      drawOnce();
      if (!reduced&&!editing) engine.runRenderLoop(render);
    }
    function resize() {
      engine.resize(); framing=Math.min(1,Math.max(.58,engine.getAspectRatio(camera)/1.6));
      for(const item of scenery) item.node.position.x=item.x*framing;
      if (!document.hidden) drawOnce();
    }
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', resume);
    engine.onContextLostObservable.add(() => { canvas.dataset.status = 'context-lost'; });
    engine.onContextRestoredObservable.add(() => { canvas.dataset.status = 'ready'; resume(); });
    await scene.whenReadyAsync();
    ready=true;resize(); resume(); canvas.dataset.status = 'ready';
    return {
      getLayout:snapshot, defaultLayout, layoutProblem:stored.problem,
      getEditorAnchor() {
        const entry=objects.get(selected);if(!entry)return null;
        const point=FISH_TYPES.includes(entry.record.type)?entry.node.position:Vector3.TransformCoordinates(new Vector3(0,templates.get(entry.record.type).metadata.height*.5,0),entry.node.computeWorldMatrix(true));
        const bounds=canvas.getBoundingClientRect(),[x,y]=projectPoint(point);
        return {x:bounds.left+x,y:bounds.top+y};
      },
      onSelection(callback){selectionChanged=callback;},
      onBeforeChange(callback){beforeChange=callback;},
      setLayout,
      select,
      setColorPreview(active) {const entry=objects.get(selected);if(entry){entry.highlighted=!active;redraw();}},
      setTransformMode(mode) {if(!['move','height','rotate','rotate-x','rotate-z','scale'].includes(mode))return false;transformMode=mode;pointerUp();return true;},
      nudgeSelection(dx,dy) {
        const object=objects.get(selected)?.record;if(!editing||!object)return false;
        if(transformMode.startsWith('rotate')){const axis=transformMode==='rotate-x'?'pitch':transformMode==='rotate-z'?'roll':'yaw';return dx!==0&&rotateObject(object,(object[axis]||0)+dx*Math.PI/36,axis);}
        if(transformMode==='height')return dy!==0&&updateObject(object.id,{y:Math.max(0,Math.min(16,object.y-dy*.2))});
        if(transformMode==='scale')return updateObject(object.id,{scale:Math.max(.25,Math.min(2.5,object.scale*Math.pow(1.05,dx||-dy)))});
        return updateObject(object.id,{x:Math.max(-30,Math.min(30,object.x+dx*.2)),z:Math.max(-8,Math.min(80,object.z-dy*.3))});
      },
      setEditMode(active) {editing=active;pointerUp();objects.forEach(updateRoot);if(!active)select(null);resume();},
      updateObject,
      addObject(type,copy) {
        if(objects.size>=MAX_REEF_OBJECTS||!templates.has(type))return null;
        const id='reef-'+Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join(''),object=reefObject(type,id,{...copy,id,type});
        if(!object)return null;
        if(object.motion==='school'&&!joinSchool(object))return null;
        changing();
        if(FISH_TYPES.includes(type)&&!copy){object.phase=((Math.PI*2-time*object.baseSpeed)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);object.z=-1.5;object.y=2-Math.sin(object.phase)*.2;}
        addRecord(object);select(object.id);redraw();return object.id;
      },
      removeObject,
      updateOptions(options) {
        if (dark !== options.dark) { dark = options.dark; sky.intensity = dark ? .3 : .95; sun.intensity = dark ? .18 : .85; }
        if (reduced !== options.reduced) { reduced = options.reduced; resume(); }
        else if (reduced && !document.hidden) drawOnce();
      },
      dispose() {window.removeEventListener('resize', resize);document.removeEventListener('visibilitychange',resume);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('pointerleave',pointerLeave);engine.dispose();canvas.dataset.status='disposed';},
    };
  } catch (error) { engine?.dispose(); canvas.dataset.status = 'unavailable'; throw error; }
}
