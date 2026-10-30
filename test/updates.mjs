import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RELEASE} from '../web/release.mjs';
import {STORAGE_KEY} from '../web/storage.mjs';
import {REEF_STORAGE_KEY,reefObject} from '../web/reef-layout.mjs';
import {parseByteRange} from '../web/range.mjs';

export async function checkUpdates(browser,name) {
  const root=fileURLToPath(new URL('../dist/',import.meta.url)),index=await readFile(resolve(root,'index.html'),'utf8'),release=await readFile(resolve(root,'release.mjs'),'utf8'),worker=await readFile(resolve(root,'sw.js'),'utf8');
  const build=/const CACHE = PREFIX \+ '([^']+)'/.exec(worker)[1],nextVersion='v'+(Number(RELEASE.version.slice(1))+1),nextBuild=build.replace(RELEASE.version+'-',nextVersion+'-');
  const changed=new Map([
    ['index.html',index.replaceAll(build,nextBuild).replace('>'+RELEASE.version+'</strong>','>'+nextVersion+'</strong>')],
    ['release.mjs',release.replace("version:'"+RELEASE.version+"'","version:'"+nextVersion+"'")],
  ]);
  const assets=JSON.parse(/^const ASSETS = (.+);$/m.exec(worker)[1]).map(asset=>changed.has(asset.path)?{...asset,hash:createHash('sha256').update(changed.get(asset.path)).digest('hex')}:asset);
  const nextWorker=worker.replaceAll(build,nextBuild).replace(/^const ASSETS = .+;$/m,'const ASSETS = '+JSON.stringify(assets)+';');
  let next=false;
  const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json','.txt':'text/plain'};
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost'),file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)),path=relative(root,file).replaceAll('\\','/');
      if(path==='..'||path.startsWith('../')||path.includes(':')){res.writeHead(403).end();return;}
      const body=Buffer.from(path==='sw.js'?(next?nextWorker:worker):next&&changed.has(path)?changed.get(path):await readFile(file));
      const headers={'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':body.length};
      const range=parseByteRange(req.headers.range,body.length);
      if(range===null){res.writeHead(416).end();return;}
      if(range){res.writeHead(206,{...headers,'Content-Length':range.end-range.start+1,'Content-Range':`bytes ${range.start}-${range.end}/${body.length}`});res.end(body.subarray(range.start,range.end+1));return;}
      res.writeHead(200,headers).end(body);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`,errors=[];
  try{
    for(const route of ['settings','popup']){
      next=false;
      const context=await browser.newContext({viewport:{width:375,height:559},hasTouch:true,locale:'de-DE',reducedMotion:'reduce'});
      let page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      const snapshot=()=>page.evaluate(({gameKey,reefKey})=>{
        const state=JSON.parse(localStorage.getItem(gameKey));return {values:state.game.values,notes:state.game.notes,seed:state.game.seed,scores:state.scores,reef:localStorage.getItem(reefKey)};
      },{gameKey:STORAGE_KEY,reefKey:REEF_STORAGE_KEY});
      try{
        await page.goto(base);await page.locator('.board-shell.ready').waitFor();
        await page.waitForFunction(async()=>{await navigator.serviceWorker.ready;return Boolean(navigator.serviceWorker.controller);});
        assert.equal(await page.locator('#update-dialog').isHidden(),true,'first installation must not request an update');
        const reef={schema:1,objects:[reefObject('blue-tang','personal-update-fish',{motion:'still',hue:45})]};
        await page.evaluate(({key,reef})=>localStorage.setItem(key,JSON.stringify(reef)),{key:REEF_STORAGE_KEY,reef});
        if(route==='settings'){
          await page.locator('#welcome-start').tap();
          const game=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).game,STORAGE_KEY),blank=game.values.findIndex(value=>!value);
          await page.locator(`[data-index="${blank}"]`).tap();await page.locator(`[data-number="${game.solution[blank]}"]`).tap();
        }
        next=true;await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).update());
        await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting));
        if(route==='settings'){
          assert.equal(await page.locator('#update-dialog').isHidden(),true,'background downloads must not interrupt active play');
          await page.reload();
        }
        await page.locator('#update-dialog').waitFor({state:'visible'});
        assert.equal(await page.locator('#app-version').innerText(),RELEASE.version);
        assert.deepEqual(await page.locator('#update-dialog button').evaluateAll(buttons=>buttons.map(button=>button.id)),['update-dismiss','update-install']);
        assert.equal(await page.locator('#update-install').innerText(),'Update');
        await page.screenshot({path:`output/${name}-update-dialog.png`});
        if(route==='settings'){
          await page.locator('#update-dismiss').tap();await page.locator('#welcome-start').tap();
          assert.equal(await page.locator('#app-version').innerText(),RELEASE.version);
          await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
          await page.waitForTimeout(1000);await page.goto(base);await page.locator('#update-dialog').waitFor({state:'visible'});
          assert.equal(await page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting)),false,'the replacement worker must already be active after closing the app');
          assert.equal(await page.locator('#app-version').innerText(),RELEASE.version,'reopening must retain the declined version');
          await page.keyboard.press('Escape');await page.locator('#welcome-start').tap();
          await page.locator('#settings-open').tap();assert.equal(await page.locator('#settings-update').isEnabled(),true);
          await page.screenshot({path:`output/${name}-update-settings.png`});
        }else{
          for(const [width,height] of [[240,320],[667,375],[375,559]]){
            await page.setViewportSize({width,height});
            assert.equal(await page.locator('#update-dialog').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),true);
          }
          await page.evaluate(key=>{
            const original=Storage.prototype.setItem;window.__denyUpdateSave=true;
            Storage.prototype.setItem=function(name,value){if(name===key&&window.__denyUpdateSave)throw new DOMException('Test save failure','QuotaExceededError');return original.call(this,name,value);};
          },STORAGE_KEY);
          await page.locator('#update-install').tap();assert.equal(await page.locator('#update-dialog-error').isVisible(),true);
          assert.equal(await page.locator('#app-version').innerText(),RELEASE.version,'failed saving must not apply the update');
          await page.evaluate(()=>window.__denyUpdateSave=false);
        }
        const before=await snapshot();
        await page.locator(route==='settings'?'#settings-update':'#update-install').tap();
        await page.waitForFunction(version=>document.getElementById('app-version')?.textContent===version,nextVersion);
        await page.locator('.board-shell.ready').waitFor();
        assert.deepEqual(await snapshot(),before,'updates must preserve the Sudoku, notes, points and reef');
        assert.equal(await page.locator('#update-dialog').isHidden(),true);
        assert.equal(await page.locator('#settings-update-notice').getAttribute('hidden')!==null,true);
      }finally{await context.close();}
    }
    assert.deepEqual(errors,[]);
    console.log(`${name}: real service-worker update, startup popup with only Update and ×, deferred version after reopening, Settings update, save failure and saved game preservation passed.`);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
