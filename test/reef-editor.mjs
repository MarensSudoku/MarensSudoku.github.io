import assert from 'node:assert/strict';
import { REEF_STORAGE_KEY,validReefLayout } from '../web/reef-layout.mjs';

export async function checkReefEditor(page,name) {
  const game=await page.evaluate(()=>JSON.parse(localStorage.getItem('marenssudoku:state:v1')));
  const enter=async()=>{await page.locator('#settings-open').click();await page.locator('#reef-editor-open').click();await page.locator('#reef-editor').waitFor({state:'visible'});};
  const release=async()=>{if(await page.locator('#reef-deselect').isVisible())await page.locator('#reef-deselect').click();};
  const behaviour=async()=>{await page.locator('#reef-properties-open').click();await page.locator('#reef-fish-settings summary').click();};
  const chooseType=async type=>{await release();const count=Number(await page.locator('#reef-count').textContent());await page.locator('#reef-add-type').click();await page.locator(`[data-reef-type="${type}"]`).click();assert.equal(Number(await page.locator('#reef-count').textContent()),count+1,'choosing a model must immediately add exactly one object');};
  const chooseObject=async id=>{await release();const count=await page.locator('#reef-count').textContent();await page.locator('#reef-object-list').click();await page.locator(`[data-reef-id="${id}"]`).check();await page.locator('#reef-edit-selected').click();assert.equal(await page.locator('#reef-count').textContent(),count,'selecting an existing object must not add a copy');};
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
  assert.deepEqual(await page.locator('.reef-editor-actions>button').evaluateAll(buttons=>buttons.map(button=>button.id)),['reef-undo','reef-object-list','reef-reset','reef-cancel','reef-finish']);
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
  await chooseObject('ledge-0');await page.locator('#reef-properties-open').click();
  assert.equal(await page.locator('#reef-hue').isVisible(),true);assert.equal(await page.locator('#reef-fish-settings').isVisible(),false,'reef objects offer colour without fish behaviour');
  assert.equal(await page.locator('#reef-properties-dialog').evaluate(dialog=>dialog.matches(':modal')),false,'colour editing must leave the reef visible and interactive');
  for(const [width,height] of [[1440,900],[375,559],[240,320]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{const r=document.getElementById('reef-properties-dialog').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    const panel=await page.locator('#reef-properties-dialog').boundingBox();
    assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width&&panel.y+panel.height<=height&&panel.height<height/2,`the compact palette must fit and leave room for the selected object: ${width}x${height}, ${JSON.stringify(panel)}`);
    await page.screenshot({path:`output/${name}-palette-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#reef-hue').evaluate(input=>{input.value='60';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.screenshot({path:`output/${name}-reef-colour.png`});
  await page.locator('#reef-properties-dialog .dialog-close').click();await page.locator('#reef-undo').click();
  await page.locator('#reef-properties-open').click();assert.equal(await page.locator('#reef-hue').inputValue(),'0','undo must restore the original colour');
  await page.locator('#reef-properties-dialog .dialog-close').click();await release();
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
  assert.equal(ring.radii.length,10);assert.ok(Math.min(...ring.radii)>50&&Math.max(...ring.radii)-Math.min(...ring.radii)<1,'controls must form a circle around the object');
  assert.equal(await page.locator('#reef-add-type').isDisabled(),true);assert.equal(await page.locator('#reef-object-list').isDisabled(),true);assert.equal(await page.locator('#reef-reset').isDisabled(),true);
  await page.mouse.move(x,yAnchor);await page.mouse.down();
  await page.mouse.move(x+60,yAnchor,{steps:5});await page.mouse.up();
  assert.equal(await selected(),id,'dragging must select the new foreground fish');
  await page.locator('#reef-undo').click();assert.equal(await page.locator('#reef-undo').isDisabled(),true,'one undo must reverse the whole drag');
  const beforeDrag={...record};record=await checkpoint();assert.deepEqual(record,beforeDrag,'undo must restore the complete object transform');
  await drag(60,0);
  record=await checkpoint();assert.ok(record.x>.05,'pointer drag must change the object position');
  const oldTop=(await page.locator('#reef-object-tools').boundingBox()).y;
  await page.locator('[data-reef-mode="height"]').click();await drag(0,-30);
  assert.notEqual((await page.locator('#reef-object-tools').boundingBox()).y,oldTop,'tools must follow the object');
  let next=await checkpoint();assert.ok(next.y>record.y,'dragging upwards in height mode must raise the object');record=next;
  await page.locator('[data-reef-mode="rotate"]').click();await drag(60,0);
  next=await checkpoint();assert.ok(next.yaw>record.yaw+.3,'dragging sideways in rotate mode must rotate the object');
  for(const key of ['x','y','z'])assert.ok(Math.abs(next[key]-record[key])<1e-6,'rotation must preserve the stationary object position');
  record=next;
  for(const [mode,field] of [['rotate-x','pitch'],['rotate-z','roll']]){
    await page.locator(`[data-reef-mode="${mode}"]`).click();await drag(60,0);
    const rotated=await checkpoint();assert.ok(Math.abs(rotated[field]-record[field]-.72)<1e-6,`${mode} must rotate its own axis`);
    for(const key of ['x','y','z','yaw',field==='pitch'?'roll':'pitch'])assert.equal(rotated[key],record[key],`${mode} must preserve other axes and position`);
    record=rotated;
  }
  await page.locator('[data-reef-mode="scale"]').click();await drag(0,-200);assert.equal((await checkpoint()).scale,2.5);
  await page.locator('[data-reef-mode="scale"]').click();await drag(0,300);record=await checkpoint();assert.equal(record.scale,.25);
  for(const [mode,key] of [['move','ArrowRight'],['height','ArrowUp'],['rotate','ArrowRight'],['rotate-x','ArrowRight'],['rotate-z','ArrowRight'],['scale','ArrowUp']]){await page.locator(`[data-reef-mode="${mode}"]`).click();await page.keyboard.press(key);}
  next=await checkpoint();
  assert.ok(Math.abs(next.x-record.x-.2)<1e-6&&Math.abs(next.y-record.y-.2)<1e-6&&Math.abs(next.yaw-record.yaw-Math.PI/36)<1e-6&&Math.abs(next.scale-record.scale*1.05)<1e-6,'all four transform modes must remain keyboard accessible');
  for(const axis of ['pitch','roll'])assert.ok(Math.abs(next[axis]-record[axis]-Math.PI/36)<1e-6,`${axis} must remain keyboard accessible`);
  assert.equal(await page.locator('[data-reef-mode][aria-pressed="true"]').count(),1,'only the active transform mode is pressed');
  if(name==='chromium'){
    await page.setViewportSize({width:375,height:559});
    record=await seed({motion:'still',x:0,y:2.6,z:-6,scale:1,yaw:0});
    const touch=await page.context().newCDPSession(page);
    try {
      for(const [mode,dx,dy,field] of [['move',35,0,'x'],['height',0,-25,'y'],['rotate',35,0,'yaw'],['rotate-x',35,0,'pitch'],['rotate-z',35,0,'roll'],['scale',0,-30,'scale']]){
        await page.locator(`[data-reef-mode="${mode}"]`).click();
        const {x,y}=await page.evaluate(()=>{for(const y of [innerHeight*.5,innerHeight*.65,innerHeight*.8])for(const x of [20,innerWidth-55])if(document.elementFromPoint(x,y)?.id==='reef-aquarium')return {x,y};throw new Error('No free canvas area for touch gesture');}),before=record[field];
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
  let transformed=await checkpoint();assert.ok(Math.abs(transformed.yaw-record.yaw)>.3);
  for(const mode of ['rotate-x','rotate-z']){
    await page.locator(`[data-reef-mode="${mode}"]`).click();const before=await page.locator('#reef-object-tools').boundingBox();await drag(40,0);const after=await page.locator('#reef-object-tools').boundingBox();
    assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<1,`${mode}: rotating a swimming route must keep its current visible position`);
    transformed=await checkpoint();
  }
  await behaviour();
  assert.deepEqual(await page.locator('#reef-properties [data-reef-field]').evaluateAll(inputs=>inputs.map(input=>input.dataset.reefField)),['hue','motion','speed','radius']);
  for(const [key,value] of Object.entries({speed:1.7,radius:2.5,hue:30}))await page.locator('#reef-'+key).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.locator('#reef-motion').selectOption('eight');
  await page.screenshot({path:`output/${name}-fish-behaviour.png`});
  await page.locator('#reef-properties-dialog .dialog-close').click();
  await page.screenshot({path:`output/${name}-reef-editor.png`});
  for(const [width,height] of [[375,559],[240,320]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{const r=document.getElementById('reef-object-tools').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    const fits=await page.evaluate(()=>{
      return document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight&&['reef-undo','reef-finish','reef-cancel','reef-add-type','reef-object-tools','reef-reset','reef-object-list'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
    });
    assert.equal(fits,true,`${name}: aquarium editor must fit ${width}x${height}`);
    if(width===375)await page.screenshot({path:`output/${name}-reef-editor-mobile.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#reef-duplicate').click();assert.equal(Number(await page.locator('#reef-count').textContent()),count+2);
  await page.locator('#reef-remove').click();assert.equal(Number(await page.locator('#reef-count').textContent()),count+1);
  await chooseObject('fish-4-0');await behaviour();
  await page.locator('#reef-speed').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#reef-properties-dialog .dialog-close').click();
  await chooseType('anthias');await behaviour();await page.locator('#reef-motion').selectOption('school');
  await page.locator('#reef-properties-dialog .dialog-close').click();
  await page.locator('#reef-finish').click();await page.locator('#reef-editor').waitFor({state:'hidden'});
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY);assert.equal(validReefLayout(saved),true);
  const fish=saved.objects.find(object=>object.id===id);assert.equal(fish.motion,'eight');assert.equal(fish.speed,1.7);assert.equal(fish.radius,2.5);
  assert.equal(fish.hue,30,'the selected palette colour must be saved');
  for(const key of ['x','y','z','scale','yaw'])assert.equal(fish[key],transformed[key],'fish behaviour controls must preserve the object transform');
  const school=saved.objects.filter(object=>object.type==='anthias'&&object.motion==='school');assert.ok(school.length>=9);assert.ok(school.every(object=>object.speed===2&&object.x===school[0].x&&object.z===school[0].z));assert.equal(new Set(school.map(object=>object.member)).size,school.length);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('marenssudoku:state:v1')));
  assert.deepEqual(after.game.values,game.game.values);assert.deepEqual(after.scores,game.scores);
  await enter();await chooseType('anemone');await page.locator('#reef-cancel').click();
  await enter();assert.equal(Number(await page.locator('#reef-count').textContent()),count+2);
  await page.locator('#reef-reset').click();await page.locator('#confirm-yes').click();assert.equal(Number(await page.locator('#reef-count').textContent()),count);
  await page.locator('#reef-cancel').click();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),saved,'discarding or resetting a draft must preserve the saved reef');
  await enter();await page.locator('#reef-object-list').click();
  const rows=page.locator('#reef-picker [data-reef-id]');assert.equal(await rows.count(),saved.objects.length);
  await rows.nth(0).check();await rows.nth(1).check();
  assert.equal(await page.locator('#reef-select-all').evaluate(input=>input.indeterminate),true);
  assert.equal(await page.locator('#reef-edit-selected').isDisabled(),true);
  await page.locator('#reef-delete-selected').click();assert.equal(Number(await page.locator('#reef-count').textContent()),saved.objects.length-2);
  await page.locator('#reef-picker-dialog .dialog-close').click();await page.locator('#reef-undo').click();
  assert.equal(Number(await page.locator('#reef-count').textContent()),saved.objects.length,'one undo must restore a batch deletion');
  assert.equal(await page.locator('#reef-undo').isDisabled(),true);
  await page.locator('#reef-object-list').click();
  await page.locator('#reef-select-all').check();await page.locator('#reef-delete-selected').click();
  assert.equal(Number(await page.locator('#reef-count').textContent()),0);
  assert.equal(await page.locator('#reef-picker .reef-picker-empty').isVisible(),true);
  await page.locator('#reef-picker-dialog .dialog-close').click();await page.locator('#reef-undo').click();
  assert.equal(Number(await page.locator('#reef-count').textContent()),saved.objects.length,'undo must restore a completely emptied reef');
  await page.locator('#reef-reset').click();await page.locator('#confirm-yes').click();await page.locator('#reef-undo').click();
  assert.equal(Number(await page.locator('#reef-count').textContent()),saved.objects.length,'undo must restore the draft after resetting');
  await page.locator('#reef-finish').click();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),saved,'undo must restore all object values and order');
  await enter();await chooseType('anemone');await page.locator('#reef-undo').click();
  assert.equal(Number(await page.locator('#reef-count').textContent()),saved.objects.length,'undo must remove the last added object');
  await page.locator('#reef-cancel').click();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),REEF_STORAGE_KEY),saved,'discard must restore a draft after bulk deleting every object');
  console.log(`${name}: reef editor drag, fish behaviour, duplicate/remove, save, cancel and reset preserve the Sudoku and personal reef.`);
  return saved;
}
