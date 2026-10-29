import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname,resolve,join } from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { REEF_TYPES } from '../web/reef-layout.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),models=join(root,'web/assets/models');
const manifest=JSON.parse(await readFile(join(models,'aquarium.json'),'utf8'));
const specs=[manifest.reef,manifest.rock,manifest.crab,manifest.anemone,...manifest.fish,...manifest.plants,...manifest.corals];
const source=`
import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {ImportMeshAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import '@babylonjs/loaders/glTF/2.0/index.js';
const canvas=document.querySelector('canvas'),engine=new Engine(canvas,true,{alpha:true,preserveDrawingBuffer:true});
window.renderModel=async(spec)=>{
 const scene=new Scene(engine);scene.clearColor=new Color4(0,0,0,0);
 const camera=new FreeCamera('preview-camera',new Vector3(.7,.7,-4.1),scene);camera.setTarget(Vector3.Zero());camera.fov=.72;
 const sky=new HemisphericLight('preview-sky',new Vector3(0,1,-1),scene);sky.intensity=1.2;sky.groundColor=new Color3(.55,.65,.7);
 const sun=new DirectionalLight('preview-sun',new Vector3(-.4,-1,.5),scene);sun.intensity=.9;
 const imported=await ImportMeshAsync('/models/'+spec.file,scene),source=new TransformNode('source',scene);
 for(const mesh of imported.meshes)if(!mesh.parent)mesh.parent=source;
 source.rotation.y=spec.yaw||0;const bounds=source.getHierarchyBoundingVectors(true),extent=bounds.max.subtract(bounds.min),scale=2.1/Math.max(extent.x,extent.y,extent.z);
 source.scaling.setAll(scale);source.position.copyFrom(bounds.min.add(bounds.max).scale(-scale/2));
 for(const mesh of imported.meshes)if(mesh.material)mesh.material.backFaceCulling=false;
 await scene.whenReadyAsync();engine.beginFrame();scene.render();engine.endFrame();
 const gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),pixels=new Uint8Array(192*192*4);gl.readPixels(0,0,192,192,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 let covered=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)covered++;
 const result={image:canvas.toDataURL('image/png'),coverage:covered/(192*192)};scene.dispose();return result;
};`;
const bundle=(await build({stdin:{contents:source,resolveDir:root,loader:'js'},bundle:true,format:'esm',write:false,minify:true})).outputFiles[0].contents;
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="192" height="192"></canvas><script type="module" src="/preview.mjs"></script>');return;}
    if(path==='/preview.mjs'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return;}
    const type=/^\/models\/([\w-]+)\.glb$/.exec(path)?.[1];
    if(!REEF_TYPES.includes(type)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type','model/gltf-binary');res.end(await readFile(join(models,type+'.glb')));
  }catch{res.writeHead(500).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:192,height:192}});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.renderModel==='function');
  await mkdir(join(models,'previews'),{recursive:true});
  for(const type of REEF_TYPES){
    const spec=specs.find(spec=>spec.file===type+'.glb');assert.ok(spec,'Preview specification missing: '+type);
    const result=await page.evaluate(spec=>window.renderModel(spec),spec);
    assert.ok(result.coverage>.005&&result.coverage<.95,'Preview must show a model with transparent margins: '+type);
    const png=Buffer.from(result.image.split(',')[1],'base64');assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    await writeFile(join(models,'previews',type+'.png'),png);console.log(type+': '+png.length+' bytes');
  }
}finally{await browser?.close();await new Promise(done=>server.close(done));}
