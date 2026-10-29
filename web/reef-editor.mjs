import { FISH_TYPES, REEF_TYPES, saveReefLayout } from './reef-layout.mjs';

const names={
  clownfish:['Anemonenfisch','Clownfish'],'blue-tang':['Blauer Doktorfisch','Blue tang'],butterflyfish:['Falterfisch','Butterflyfish'],wrasse:['Lippfisch','Wrasse'],anthias:['Fahnenbarsch','Anthias'],chromis:['Grüner Riffbarsch','Green chromis'],
  reef:['Bunter Korallengarten','Mixed coral garden'],'reef-ledge':['Riffgestein','Reef rock'],'ribbon-grass':['Grüne Wasserpflanze','Ribbon grass'],'sea-fern':['Meeresfarn','Sea fern'],anemone:['Lila Anemone','Purple anemone'],'reef-crab':['Riffkrebs','Reef crab'],
  'coral-fan':['Fächerkoralle','Sea fan'],'coral-staghorn':['Geweihkoralle','Staghorn coral'],'coral-plates':['Tellerkoralle','Plate coral'],'coral-brain':['Hirnkoralle','Brain coral'],'coral-tubes':['Röhrenkoralle','Tube coral'],
};
export function setupReefEditor(aquarium,{t,language,onModeChange,confirmReset,readOnly}) {
  const $=id=>document.getElementById(id), root=$('reef-editor'), open=$('reef-editor-open');
  let selected=null, original=null, addType=REEF_TYPES[0],mode='move';
  const history=[];
  let restoring=false,pointerAction=null,pointerSaved=false;
  const label=type=>names[type][language()==='de'?0:1], tools=$('reef-object-tools'), picker=$('reef-picker-dialog'), properties=$('reef-properties-dialog');
  const preview=type=>`./assets/models/previews/${type}.png`;
  const hints={move:'reefMoveHint',height:'reefHeightHint',rotate:'reefRotateHint','rotate-x':'reefRotateXHint','rotate-z':'reefRotateZHint',scale:'reefScaleHint'};
  function message(key,warning=false) {const node=$('reef-message'),copy=t(key);if(node.textContent!==copy)node.textContent=copy;node.dataset.warning=String(warning);}
  function setMode(next) {
    if(!aquarium.setTransformMode(next))return;
    mode=next;
    tools.querySelectorAll('[data-reef-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reefMode===mode)));
    if(selected&&$('reef-message').dataset.warning!=='true')message(hints[mode]);
  }
  function list() { $('reef-count').textContent=String(aquarium.getLayout().objects.length); }
  function resetUndo() {history.length=0;pointerAction=null;$('reef-undo').disabled=true;}
  function remember() {
    if(!original||restoring||(pointerAction!==null&&pointerSaved))return;
    history.push({layout:aquarium.getLayout(),selected});if(history.length>50)history.shift();
    pointerSaved=pointerAction!==null;$('reef-undo').disabled=false;
  }
  function undo() {
    const previous=history.at(-1);if(!original||!previous)return;
    restoring=true;
    try {if(!aquarium.setLayout(previous.layout))return;history.pop();aquarium.select(previous.selected);list();}
    finally {restoring=false;$('reef-undo').disabled=!history.length;}
  }
  function positionTools() {
    if(!original||!selected)return;
    const anchor=aquarium.getEditorAnchor();if(!anchor)return;
    const top=document.querySelector('.reef-editor-top').getBoundingClientRect().bottom+10;
    const bottom=document.querySelector('.reef-editor-bottom').getBoundingClientRect().top-10;
    const buttons=tools.querySelectorAll('button:not([hidden])');buttons.forEach((button,index)=>button.style.setProperty('--angle',`${index*360/buttons.length}deg`));
    const size=Math.max(112,Math.min(196,innerWidth-16,bottom-top));
    tools.style.setProperty('--ring-size',`${size}px`);
    const spacing=Math.sin(Math.PI/buttons.length);
    tools.style.setProperty('--ring-button',`${Math.max(24,Math.min(40,Math.floor(((size-4)*spacing-2)/(1+spacing))))}px`);
    const left=anchor.x-size/2;
    tools.style.left=`${Math.max(8,Math.min(innerWidth-tools.offsetWidth-8,left))}px`;
    tools.style.top=`${Math.max(top,Math.min(bottom-tools.offsetHeight,anchor.y-tools.offsetHeight/2))}px`;
    if(properties.open){
      properties.style.left=`${anchor.x>innerWidth/2?12:Math.max(12,innerWidth-properties.offsetWidth-12)}px`;
      properties.style.top=`${anchor.y>innerHeight/2?12:Math.max(12,innerHeight-properties.offsetHeight-12)}px`;
    }
  }
  function showSelection(object) {
    selected=object?.id||null;root.dataset.selected=selected||'';tools.hidden=!object;
    $('reef-add-type').disabled=Boolean(object);$('reef-object-list').disabled=Boolean(object);$('reef-reset').disabled=Boolean(object);
    if(!object){properties.close();if(original)message('reefHint');return;}
    $('reef-selected-name').textContent=label(object.type);$('reef-properties-name').textContent=label(object.type);
    if($('reef-message').dataset.warning!=='true')message(hints[mode]);
    $('reef-fish-settings').hidden=!FISH_TYPES.includes(object.type);
    $('reef-motion').title=object.motion==='school'?t('reefSchoolHint'):'';
    for(const input of properties.querySelectorAll('[data-reef-field]')) {
      const key=input.dataset.reefField,value=object[key];
      input.value=String(value);
      const output=$('reef-'+key+'-value');
      if(output)output.textContent=key==='hue'?(value?`${Math.round(value)}°`:t('reefOriginalColor')):Number(value).toFixed(1);
    }
    positionTools();
  }
  function renderText() {
    $('reef-add-type').querySelector('img').src=preview(addType);
    $('reef-add-type').querySelector('span').textContent=label(addType);
    $('reef-add-type').setAttribute('aria-label',`${t('reefAddType')}: ${label(addType)}`);
    document.querySelectorAll('[data-reef-label]').forEach(button=>{button.title=t(button.dataset.reefLabel);button.setAttribute('aria-label',button.title);});
    tools.setAttribute('aria-label',t('reefObjectSettings'));
    list();showSelection(aquarium.getLayout().objects.find(object=>object.id===selected));updateListActions();
  }
  function updateListActions() {
    const checks=[...picker.querySelectorAll('[data-reef-id]')],marked=checks.filter(input=>input.checked),all=$('reef-select-all');
    all.disabled=!checks.length;all.checked=checks.length>0&&marked.length===checks.length;all.indeterminate=marked.length>0&&marked.length<checks.length;
    $('reef-edit-selected').disabled=marked.length!==1;$('reef-delete-selected').disabled=!marked.length;
    $('reef-delete-selected').textContent=t('reefDeleteSelected')+(marked.length?` (${marked.length})`:'');
  }
  function showPicker(existing) {
    $('reef-picker-title').textContent=t(existing?'reefSelection':'reefAddType');
    $('reef-list-actions').hidden=!existing;
    const choices=existing?aquarium.getLayout().objects:REEF_TYPES.map(type=>({type}));
    $('reef-picker').replaceChildren(...choices.map((object,i)=>{
      const card=document.createElement(existing?'label':'button'),image=document.createElement('img'),name=document.createElement('span');
      image.src=preview(object.type);image.alt='';image.width=96;image.height=80;
      name.textContent=label(object.type)+(existing?` · ${i+1}`:'');
      if(existing){const check=document.createElement('input');check.type='checkbox';check.dataset.reefId=object.id;check.addEventListener('change',updateListActions);card.append(check);}
      else{card.type='button';card.dataset.reefType=object.type;card.setAttribute('aria-pressed',String(object.type===addType));card.addEventListener('click',()=>{
        picker.close();
        if(aquarium.addObject(object.type)){addType=object.type;renderText();message(hints[mode]);}
        else message('reefFull',true);
      });}
      card.append(image,name);return card;
    }));
    if(existing&&!choices.length){const empty=document.createElement('p');empty.className='reef-picker-empty';empty.textContent=t('reefNoObjects');$('reef-picker').append(empty);}
    updateListActions();if(!picker.open)picker.showModal();
  }
  function finish(save) {
    if(save&&!saveReefLayout(aquarium.getLayout())){message('reefSaveFailed',true);return;}
    picker.close();properties.close();
    if(!save)aquarium.setLayout(original);
    aquarium.setEditMode(false);root.hidden=true;delete document.body.dataset.editor;
    document.querySelector('.site-header').inert=false;original=null;resetUndo();onModeChange(false);
  }
  $('reef-editor-status').textContent='';
  function start() {
    if(readOnly||original)return;
    resetUndo();original=aquarium.getLayout();$('settings-dialog').close();root.hidden=false;document.body.dataset.editor='true';
    document.querySelector('.site-header').inert=true;aquarium.setEditMode(true);setMode('move');onModeChange(true);
    list();showSelection(null);message(aquarium.layoutProblem?'reefInvalid':'reefHint',Boolean(aquarium.layoutProblem));$('reef-add-type').focus();
  }
  for(const button of [open,$('reef-view-edit')]) {button.disabled=readOnly;button.addEventListener('click',start);}
  $('reef-finish').addEventListener('click',()=>finish(true));
  $('reef-cancel').addEventListener('click',()=>finish(false));
  $('reef-undo').addEventListener('click',undo);
  $('reef-add-type').addEventListener('click',()=>showPicker(false));
  $('reef-object-list').addEventListener('click',()=>showPicker(true));
  $('reef-select-all').addEventListener('change',()=>{picker.querySelectorAll('[data-reef-id]').forEach(input=>input.checked=$('reef-select-all').checked);updateListActions();});
  $('reef-edit-selected').addEventListener('click',()=>{const input=picker.querySelector('[data-reef-id]:checked');if(input){picker.close();aquarium.select(input.dataset.reefId);}});
  $('reef-delete-selected').addEventListener('click',()=>{const ids=new Set([...picker.querySelectorAll('[data-reef-id]:checked')].map(input=>input.dataset.reefId)),layout=aquarium.getLayout();aquarium.setLayout({...layout,objects:layout.objects.filter(object=>!ids.has(object.id))});list();showPicker(true);});
  $('reef-properties-open').addEventListener('click',()=>{properties.show();positionTools();$('reef-hue').focus();});
  properties.addEventListener('close',()=>{$('reef-fish-settings').open=false;if(selected&&original)$('reef-properties-open').focus();});
  $('reef-fish-settings').addEventListener('toggle',positionTools);
  $('reef-deselect').addEventListener('click',()=>{aquarium.select(null);$('reef-object-list').focus();});
  $('reef-remove').addEventListener('click',()=>{if(selected)aquarium.removeObject(selected);list();$('reef-object-list').focus();});
  $('reef-duplicate').addEventListener('click',()=>{
    const object=aquarium.getLayout().objects.find(object=>object.id===selected);if(!object)return;
    const copy={...object,x:Math.min(30,object.x+.6),z:Math.min(80,object.z+.3),phase:Math.min(100,object.phase+.3),member:(object.member+1)%50};
    if(!aquarium.addObject(object.type,copy))message('reefFull',true);else message(hints[mode]);list();
  });
  $('reef-reset').addEventListener('click',async()=>{if(await confirmReset()){aquarium.setLayout(aquarium.defaultLayout);list();}});
  properties.addEventListener('input',event=>{
    const key=event.target.dataset.reefField;if(!key||!selected)return;
    const value=key==='motion'?event.target.value:Number(event.target.value);
    aquarium.updateObject(selected,{[key]:value});
  });
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-reef-mode]');if(button)setMode(button.dataset.reefMode);
  });
  window.addEventListener('resize',positionTools);
  document.addEventListener('pointerdown',event=>{if(original&&event.isPrimary){pointerAction=event.pointerId;pointerSaved=false;}},true);
  function endPointerAction(event) {if(event.pointerId===pointerAction)pointerAction=null;}
  document.addEventListener('pointerup',endPointerAction,true);document.addEventListener('pointercancel',endPointerAction,true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&properties.open){event.preventDefault();properties.close();return;}
    if(!original||!selected||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]'))return;
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(direction&&aquarium.nudgeSelection(...direction))event.preventDefault();
  });
  aquarium.onBeforeChange(remember);aquarium.onSelection(showSelection);renderText();
  return {renderText};
}
