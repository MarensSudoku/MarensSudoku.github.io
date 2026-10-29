import assert from 'node:assert/strict';
import { REEF_STORAGE_KEY,validReefLayout } from '../web/reef-layout.mjs';

export async function checkReefEditor(page,name) {
  const game=await page.evaluate(()=>JSON.parse(localStorage.getItem('marenssudoku:state:v1')));
  const enter=async()=>{await page.locator('#settings-open').click();await page.locator('#reef-editor-open').click();await page.locator('#reef-editor').waitFor({state:'visible'});};
  const chooseType=async type=>{const count=Number(await page.locator('#reef-count').textContent());await page.locator('#reef-add-type').click();await page.locator(`[data-reef-type="${type}"]`).click();assert.equal(Number(await page.locator('#reef-count').textContent()),count+1,'choosing a model must immediately add exactly one object');};
  const chooseObject=async id=>{const count=await page.locator('#reef-count').textContent();await page.locator('#reef-object-list').click();await page.locator(`[data-reef-id="${id}"]`).click();assert.equal(await page.locator('#reef-count').textContent(),count,'selecting an existing object must not add a copy');};
  const selected=()=>page.locator('#reef-editor').getAttribute('data-selected');
  const drag=async(dx,dy)=>{
    const box=await page.locator('#reef-object-tools').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:6});await page.mouse.up();
  };
  await page.locator('#settings-open').click();await page.locator('#reduced-motion').uncheck();await page.locator('#settings-dialog .dialog-close').click();
  await page.locator('#reef-view-toggle').click();
  assert.equal(await page.locator('.reef-layout').isVisible(),false);
  const viewClock=await page.locator('#round-time').textContent(),draws=await page.evaluate(()=>window.__aquariumDraws);
  await page.keyboard.press('1');await page.waitForTimeout(1100);
  assert.equal(await page.locator('#round-time').textContent(),viewClock,'viewing the reef must pause the Sudoku timer');
  assert.ok(await page.evaluate(()=>window.__aquariumDraws)>draws,'fish must keep swimming while watching the reef');
  await page.locator('#reef-view-edit').click();await page.locator('#reef-editor').waitFor({state:'visible'});
  assert.equal(await page.locator('#reef-view-actions').isVisible(),false);
  await page.locator('#reef-cancel').click();assert.equal(await page.locator('#reef-view-toggle').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'reef-view-toggle');
  await page.screenshot({path:`output/${name}-reef-view.png`});
  for(const [width,height] of [[375,559],[240,320]]){
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(()=>['reef-view-toggle','reef-view-edit'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})),true,'reef view actions must fit mobile screens');
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#reef-view-toggle').click();assert.equal(await page.locator('.reef-layout').isVisible(),true);
  await page.locator('#settings-open').click();await page.locator('#reduced-motion').check();await page.locator('#settings-dialog .dialog-close').click();
  await enter();
  const count=Number(await page.locator('#reef-count').textContent()),clock=await page.locator('#round-time').textContent();
  await page.waitForTimeout(1100);assert.equal(await page.locator('#round-time').textContent(),clock,'arranging the reef must pause the Sudoku timer');
  await page.locator('#reef-object-list').click();
  assert.equal(await page.locator('[data-reef-id^="foreground-plant-"]').count(),4);
  assert.equal(await page.locator('[data-reef-id^="foreground-anemone-"]').count(),2);
  await page.locator('#reef-picker-dialog .dialog-close').click();
  await page.locator('#reef-add-type').click();assert.equal(await page.locator('[data-reef-type]').count(),17);
  await page.waitForFunction(()=>[...document.querySelectorAll('#reef-picker img')].every(img=>img.complete&&img.naturalWidth===192));
  await page.screenshot({path:`output/${name}-reef-picker.png`});
  await page.locator('[data-reef-type="blue-tang"]').click();assert.equal(await page.locator('#reef-add').count(),0);
  const id=await selected();assert.equal(Number(await page.locator('#reef-count').textContent()),count+1);
  const readLayout=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY);
  const saveDraft=async()=>{await page.locator('#reef-finish').click();const layout=await readLayout();assert.equal(validReefLayout(layout),true);return layout;};
  const checkpoint=async()=>{const layout=await saveDraft();await enter();await chooseObject(id);return layout.objects.find(object=>object.id===id);};
  const seed=async patch=>{
    const layout=await saveDraft();Object.assign(layout.objects.find(object=>object.id===id),patch);assert.equal(validReefLayout(layout),true);
    await page.evaluate(({key,layout})=>localStorage.setItem(key,JSON.stringify(layout)),{key:REEF_STORAGE_KEY,layout});
    await page.reload();await page.waitForFunction(()=>document.querySelector('#reef-aquarium').dataset.status==='ready');await page.locator('#welcome-start').click();
    await enter();await chooseObject(id);return layout.objects.find(object=>object.id===id);
  };
  let record=await seed({motion:'still',x:0,y:3,z:-6,scale:1,yaw:0});
  const target=await page.locator('#reef-object-tools').boundingBox(),x=target.x+target.width/2,yAnchor=target.y+target.height/2;
  const ring=await page.locator('#reef-object-tools').evaluate(root=>{
    const box=root.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2,style=getComputedStyle(root);
    return {clear:style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.boxShadow==='none'&&style.borderTopWidth==='0px',centre:document.elementFromPoint(cx,cy)?.id,radii:[...root.querySelectorAll('button')].map(button=>{const b=button.getBoundingClientRect();return Math.hypot(b.left+b.width/2-cx,b.top+b.height/2-cy);})};
  });
  assert.equal(ring.clear,true,'ring controls must have no surrounding panel');
  assert.equal(ring.centre,'reef-aquarium','the object at the menu centre must remain draggable');
  assert.equal(ring.radii.length,7);assert.ok(Math.min(...ring.radii)>50&&Math.max(...ring.radii)-Math.min(...ring.radii)<1,'controls must form a circle around the object');
  await page.mouse.move(x,yAnchor);await page.mouse.down();
  await page.mouse.move(x+60,yAnchor,{steps:5});await page.mouse.up();
  assert.equal(await selected(),id,'dragging must select the new foreground fish');
  record=await checkpoint();assert.ok(record.x>.05,'pointer drag must change the object position');
  const oldTop=(await page.locator('#reef-object-tools').boundingBox()).y;
  await page.locator('[data-reef-mode="height"]').click();await drag(0,-30);
  assert.notEqual((await page.locator('#reef-object-tools').boundingBox()).y,oldTop,'tools must follow the object');
  let next=await checkpoint();assert.ok(next.y>record.y,'dragging upwards in height mode must raise the object');record=next;
  await page.locator('[data-reef-mode="rotate"]').click();await drag(60,0);
  next=await checkpoint();assert.ok(next.yaw>record.yaw+.3,'dragging sideways in rotate mode must rotate the object');
  for(const key of ['x','y','z'])assert.ok(Math.abs(next[key]-record[key])<1e-6,'rotation must preserve the stationary object position');
  await page.locator('[data-reef-mode="scale"]').click();await drag(0,-200);assert.equal((await checkpoint()).scale,2.5);
  await page.locator('[data-reef-mode="scale"]').click();await drag(0,300);record=await checkpoint();assert.equal(record.scale,.25);
  for(const [mode,key] of [['move','ArrowRight'],['height','ArrowUp'],['rotate','ArrowRight'],['scale','ArrowUp']]){await page.locator(`[data-reef-mode="${mode}"]`).click();await page.keyboard.press(key);}
  next=await checkpoint();
  assert.ok(Math.abs(next.x-record.x-.2)<1e-6&&Math.abs(next.y-record.y-.2)<1e-6&&Math.abs(next.yaw-record.yaw-Math.PI/36)<1e-6&&Math.abs(next.scale-record.scale*1.05)<1e-6,'all four transform modes must remain keyboard accessible');
  assert.equal(await page.locator('[data-reef-mode][aria-pressed="true"]').count(),1,'only the active transform mode is pressed');
  if(name==='chromium'){
    await page.setViewportSize({width:375,height:559});
    record=await seed({motion:'still',x:0,y:2.6,z:-6,scale:1,yaw:0});
    const touch=await page.context().newCDPSession(page);
    try {
      for(const [mode,dx,dy,field] of [['move',35,0,'x'],['height',0,-25,'y'],['rotate',35,0,'yaw'],['scale',0,-30,'scale']]){
        await page.locator(`[data-reef-mode="${mode}"]`).click();
        const box=await page.locator('#reef-object-tools').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,before=record[field];
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
        for(let i=1;i<=6;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/6,y:y+dy*i/6,id:1}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await selected(),id,`touch ${mode} must keep the selected object`);
        record=await checkpoint();assert.ok(record[field]>before,`touch ${mode} must update ${field}`);
      }
    }finally{await touch.detach();}
    await page.setViewportSize({width:1440,height:900});
  }
  record=await seed({motion:'circle',x:0,y:2.2,z:-6,scale:1.3,yaw:.5,phase:1});
  await page.locator('[data-reef-mode="rotate"]').click();
  const beforeTurn=await page.locator('#reef-object-tools').boundingBox();await drag(40,0);
  const afterTurn=await page.locator('#reef-object-tools').boundingBox();
  assert.equal(await selected(),id);
  assert.ok(Math.hypot(afterTurn.x-beforeTurn.x,afterTurn.y-beforeTurn.y)<1,'turning a swimming fish must preserve its on-screen position');
  const transformed=await checkpoint();assert.ok(Math.abs(transformed.yaw-record.yaw)>.3);
  await page.locator('#reef-properties-open').click();
  assert.deepEqual(await page.locator('#reef-properties [data-reef-field]').evaluateAll(inputs=>inputs.map(input=>input.dataset.reefField)),['motion','speed','radius']);
  for(const [key,value] of Object.entries({speed:1.7,radius:2.5}))await page.locator('#reef-'+key).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.locator('#reef-motion').selectOption('eight');
  await page.screenshot({path:`output/${name}-fish-behaviour.png`});
  await page.locator('#reef-properties-dialog .dialog-close').click();
  await page.screenshot({path:`output/${name}-reef-editor.png`});
  for(const [width,height] of [[375,559],[240,320]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{const r=document.getElementById('reef-object-tools').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    const fits=await page.evaluate(()=>{
      return document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight&&['reef-finish','reef-cancel','reef-add-type','reef-object-tools'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    });
    assert.equal(fits,true,`${name}: aquarium editor must fit ${width}x${height}`);
    if(width===375)await page.screenshot({path:`output/${name}-reef-editor-mobile.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#reef-duplicate').click();assert.equal(Number(await page.locator('#reef-count').textContent()),count+2);
  await page.locator('#reef-remove').click();assert.equal(Number(await page.locator('#reef-count').textContent()),count+1);
  await chooseObject('fish-4-0');await page.locator('#reef-properties-open').click();
  await page.locator('#reef-speed').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#reef-properties-dialog .dialog-close').click();
  await chooseType('anthias');await page.locator('#reef-properties-open').click();await page.locator('#reef-motion').selectOption('school');
  await page.locator('#reef-properties-dialog .dialog-close').click();
  await page.locator('#reef-finish').click();await page.locator('#reef-editor').waitFor({state:'hidden'});
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY);assert.equal(validReefLayout(saved),true);
  const fish=saved.objects.find(object=>object.id===id);assert.equal(fish.motion,'eight');assert.equal(fish.speed,1.7);assert.equal(fish.radius,2.5);
  for(const key of ['x','y','z','scale','yaw'])assert.equal(fish[key],transformed[key],'fish behaviour controls must preserve the object transform');
  const school=saved.objects.filter(object=>object.type==='anthias'&&object.motion==='school');assert.ok(school.length>=9);assert.ok(school.every(object=>object.speed===2&&object.x===school[0].x&&object.z===school[0].z));assert.equal(new Set(school.map(object=>object.member)).size,school.length);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('marenssudoku:state:v1')));
  assert.deepEqual(after.game.values,game.game.values);assert.deepEqual(after.scores,game.scores);
  await enter();await chooseType('anemone');await page.locator('#reef-cancel').click();
  await enter();assert.equal(Number(await page.locator('#reef-count').textContent()),count+2);
  await page.locator('#reef-reset').click();await page.locator('#confirm-yes').click();assert.equal(Number(await page.locator('#reef-count').textContent()),count);
  await page.locator('#reef-cancel').click();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),saved,'discarding or resetting a draft must preserve the saved reef');
  console.log(`${name}: reef editor drag, fish behaviour, duplicate/remove, save, cancel and reset preserve the Sudoku and personal reef.`);
  return saved;
}
