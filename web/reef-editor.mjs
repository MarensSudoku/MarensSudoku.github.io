import { FISH_TYPES, REEF_TYPES, saveReefLayout } from './reef-layout.mjs';

const names={
  clownfish:['Anemonenfisch','Clownfish'],'blue-tang':['Blauer Doktorfisch','Blue tang'],butterflyfish:['Falterfisch','Butterflyfish'],wrasse:['Lippfisch','Wrasse'],anthias:['Fahnenbarsch','Anthias'],chromis:['Grüner Riffbarsch','Green chromis'],
  reef:['Bunter Korallengarten','Mixed coral garden'],'reef-ledge':['Riffgestein','Reef rock'],'ribbon-grass':['Grüne Wasserpflanze','Ribbon grass'],'sea-fern':['Meeresfarn','Sea fern'],anemone:['Lila Anemone','Purple anemone'],'reef-crab':['Riffkrebs','Reef crab'],
  'coral-fan':['Fächerkoralle','Sea fan'],'coral-staghorn':['Geweihkoralle','Staghorn coral'],'coral-plates':['Tellerkoralle','Plate coral'],'coral-brain':['Hirnkoralle','Brain coral'],'coral-tubes':['Röhrenkoralle','Tube coral'],
};
export function setupReefEditor(aquarium,{t,language,onModeChange,confirmReset,readOnly}) {
  const $=id=>document.getElementById(id), root=$('reef-editor'), open=$('reef-editor-open');
  let selected=null, original=null, addType=REEF_TYPES[0],mode='move';
  const label=type=>names[type][language()==='de'?0:1], tools=$('reef-object-tools'), picker=$('reef-picker-dialog'), properties=$('reef-properties-dialog');
  const preview=type=>`./assets/models/previews/${type}.png`;
  const hints={move:'reefMoveHint',height:'reefHeightHint',rotate:'reefRotateHint',scale:'reefScaleHint'};
  function message(key,warning=false) {const node=$('reef-message'),copy=t(key);if(node.textContent!==copy)node.textContent=copy;node.dataset.warning=String(warning);}
  function setMode(next) {
    if(!aquarium.setTransformMode(next))return;
    mode=next;
    tools.querySelectorAll('[data-reef-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reefMode===mode)));
    if(selected&&$('reef-message').dataset.warning!=='true')message(hints[mode]);
  }
  function list() { $('reef-count').textContent=String(aquarium.getLayout().objects.length); }
  function positionTools() {
    if(!original||!selected)return;
    const anchor=aquarium.getEditorAnchor();if(!anchor)return;
    const top=document.querySelector('.reef-editor-top').getBoundingClientRect().bottom+10;
    const bottom=document.querySelector('.reef-editor-bottom').getBoundingClientRect().top-10;
    const buttons=tools.querySelectorAll('button:not([hidden])');buttons.forEach((button,index)=>button.style.setProperty('--angle',`${index*360/buttons.length}deg`));
    const size=Math.max(112,Math.min(196,innerWidth-16,bottom-top));
    tools.style.setProperty('--ring-size',`${size}px`);
    tools.style.setProperty('--ring-button',`${size<150?28:40}px`);
    const left=anchor.x-size/2;
    tools.style.left=`${Math.max(8,Math.min(innerWidth-tools.offsetWidth-8,left))}px`;
    tools.style.top=`${Math.max(top,Math.min(bottom-tools.offsetHeight,anchor.y-tools.offsetHeight/2))}px`;
  }
  function showSelection(object) {
    selected=object?.id||null;root.dataset.selected=selected||'';tools.hidden=!object;
    if(!object)return;
    $('reef-selected-name').textContent=label(object.type);$('reef-properties-name').textContent=label(object.type);
    if($('reef-message').dataset.warning!=='true')message(hints[mode]);
    $('reef-properties-open').hidden=!FISH_TYPES.includes(object.type);
    $('reef-motion').title=object.motion==='school'?t('reefSchoolHint'):'';
    for(const input of properties.querySelectorAll('[data-reef-field]')) {
      const key=input.dataset.reefField,value=object[key];
      input.value=String(value);
      const output=$('reef-'+key+'-value');
      if(output)output.textContent=Number(value).toFixed(1);
    }
    positionTools();
  }
  function renderText() {
    $('reef-add-type').querySelector('img').src=preview(addType);
    $('reef-add-type').querySelector('span').textContent=label(addType);
    $('reef-add-type').setAttribute('aria-label',`${t('reefAddType')}: ${label(addType)}`);
    document.querySelectorAll('[data-reef-label]').forEach(button=>{button.title=t(button.dataset.reefLabel);button.setAttribute('aria-label',button.title);});
    tools.setAttribute('aria-label',t('reefObjectSettings'));
    list();showSelection(aquarium.getLayout().objects.find(object=>object.id===selected));
  }
  function showPicker(existing) {
    $('reef-picker-title').textContent=t(existing?'reefSelection':'reefAddType');
    const choices=existing?aquarium.getLayout().objects:REEF_TYPES.map(type=>({type}));
    $('reef-picker').replaceChildren(...choices.map((object,i)=>{
      const button=document.createElement('button'),image=document.createElement('img'),name=document.createElement('span');
      button.type='button';button.dataset[existing?'reefId':'reefType']=existing?object.id:object.type;
      image.src=preview(object.type);image.alt='';image.width=96;image.height=80;
      name.textContent=label(object.type)+(existing?` · ${i+1}`:'');button.append(image,name);
      button.setAttribute('aria-pressed',String(existing?object.id===selected:object.type===addType));
      button.addEventListener('click',()=>{
        picker.close();
        if(existing)aquarium.select(object.id);
        else if(aquarium.addObject(object.type)){addType=object.type;renderText();message(hints[mode]);}
        else message('reefFull',true);
      });
      return button;
    }));
    picker.showModal();
  }
  function finish(save) {
    if(save&&!saveReefLayout(aquarium.getLayout())){message('reefSaveFailed',true);return;}
    picker.close();properties.close();
    if(!save)aquarium.setLayout(original);
    aquarium.setEditMode(false);root.hidden=true;delete document.body.dataset.editor;
    document.querySelector('.site-header').inert=false;original=null;onModeChange(false);
  }
  $('reef-editor-status').textContent='';
  function start() {
    if(readOnly||original)return;
    original=aquarium.getLayout();$('settings-dialog').close();root.hidden=false;document.body.dataset.editor='true';
    document.querySelector('.site-header').inert=true;aquarium.setEditMode(true);setMode('move');onModeChange(true);
    list();showSelection(null);message(aquarium.layoutProblem?'reefInvalid':'reefHint',Boolean(aquarium.layoutProblem));$('reef-add-type').focus();
  }
  for(const button of [open,$('reef-view-edit')]) {button.disabled=readOnly;button.addEventListener('click',start);}
  $('reef-finish').addEventListener('click',()=>finish(true));
  $('reef-cancel').addEventListener('click',()=>finish(false));
  $('reef-add-type').addEventListener('click',()=>showPicker(false));
  $('reef-object-list').addEventListener('click',()=>showPicker(true));
  $('reef-properties-open').addEventListener('click',()=>properties.showModal());
  $('reef-remove').addEventListener('click',()=>{if(selected)aquarium.removeObject(selected);list();$('reef-object-list').focus();});
  $('reef-duplicate').addEventListener('click',()=>{
    const object=aquarium.getLayout().objects.find(object=>object.id===selected);if(!object)return;
    const copy={...object,x:Math.min(18,object.x+.6),z:Math.min(40,object.z+.3),phase:Math.min(100,object.phase+.3),member:(object.member+1)%50};
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
  document.addEventListener('keydown',event=>{
    if(!original||!selected||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]'))return;
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(direction&&aquarium.nudgeSelection(...direction))event.preventDefault();
  });
  aquarium.onSelection(showSelection);renderText();
  return {renderText};
}
