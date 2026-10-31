import { createEffects } from './game/effects.mjs';
import { createScreenWakeLock } from './screen.mjs';
import { setupReefEditor } from './reef-editor.mjs';
import {REEF_REWARDS} from './reef-additions.mjs';
import { conflicts, isSolved, PEERS } from './sudoku/engine.mjs';
import { createGame, restartGame, enter, undo, fullUnits, complete, emptyProgress, emptyScores, progressValue, ACHIEVEMENTS, validGame } from './sudoku/model.mjs';
import { load, save, STORAGE_KEY } from './storage.mjs';
import { setupMusic } from './music.mjs';
import { RELEASE } from './release.mjs';
import { LOCALES } from './locales.mjs';

const $ = id => document.getElementById(id);
const state = load();
let game = state.game, progress = state.progress, scores = state.scores, settings = state.settings;
let storageBlocked = state.problem, readOnly = false, busy = false, noteMode = false;
let selection = game ? Math.max(0, game.values.findIndex(v => !v)) : 0;
let workerJob = null, generation = 0, updateWorker = null, updatePrompted = false;
let startupUpdateCheck=Promise.resolve();
let clockAt = performance.now(), clockGame = null, clockActive = false, clockTicks = 0;
const screenWake = createScreenWakeLock();
const media = matchMedia('(prefers-reduced-motion: reduce)');
// Each language is its own module; reading aids for the legal texts load with it.
const loadStrings = code => Promise.all([import(`./i18n/${code}.mjs`), import(`./i18n/${code}-legal.mjs`)]).then(([ui, legal]) => ({ ...ui.default, legal:legal.default }));
let strings = await loadStrings(settings.language), languageRequest = 0;
const t = key => strings[key] ?? key;
const locale = () => LOCALES[settings.language].tag;
const reduced = () => settings.reducedMotion || media.matches;
let aquarium, aquariumReady, reefEditor, reefEditing = false, reefViewing = false, screenActive = false;
function updateBackground() {
  aquarium?.updateOptions({ reduced:reduced(), dark:settings.theme === 'dark' });
}
const music = setupMusic(settings, t, persist);
const scene = createEffects('board-effects');
scene.onReady = renderBoard;

const cells = [];
for (let row = 0; row < 9; row++) {
  const line = document.createElement('div'); line.className = 'board-row'; line.setAttribute('role', 'row');
  for (let col = 0; col < 9; col++) {
    const index = row * 9 + col, cell = document.createElement('button');
    cell.type = 'button'; cell.className = 'cell'; cell.dataset.index = index; cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-colindex', col + 1); cell.setAttribute('aria-rowindex', row + 1);
    cell.addEventListener('click', () => { selection = index; renderBoard(); });
    line.append(cell); cells.push(cell);
  }
  $('board').append(line);
}
for (let n = 1; n <= 9; n++) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = n; button.dataset.number = n;
  button.addEventListener('click', () => input(n)); $('number-pad').append(button);
}

function announce(message) { $('announcement').textContent = message; }
function showNotice(key) { $('notice').hidden = false; $('notice-text').textContent = t(key); }
function renderRoundStats() {
  const seconds = Math.floor((game?.elapsedMs || 0) / 1000), minutes = Math.floor(seconds / 60);
  $('round-time').textContent = `${String(minutes).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  $('round-time').setAttribute('datetime', `PT${seconds}S`); $('round-time').title = t('activeTime');
  $('round-points').textContent = scores.points.toLocaleString(locale());
  $('round-points').title = t('totalPoints');
}
function syncClock() {
  const now = performance.now();
  if (clockActive && clockGame === game && !game.completionRecorded) game.elapsedMs = Math.min(Number.MAX_SAFE_INTEGER, game.elapsedMs + Math.round(now - clockAt));
  clockAt = now; clockGame = game;
  const available=!busy&&!readOnly&&!document.hidden&&!document.querySelector('dialog[open]');
  clockActive=Boolean(game&&!game.completionRecorded&&available&&!reefEditing&&!reefViewing);
  const awake=available&&(clockActive||reefEditing||reefViewing);
  if(awake!==screenActive){screenActive=awake;screenWake.update(awake);}
  renderRoundStats();
}
function persist() {
  syncClock();
  if (storageBlocked || readOnly) return;
  const ok = save(game, settings, progress, scores);
  if (!ok) showNotice('storageFailed');
}
function renderSfxVolume() { $('sfx-volume').style.setProperty('--p', `${$('sfx-volume').value}%`); $('sfx-volume-value').textContent = `${$('sfx-volume').value} %`; }
function renderText() {
  const language = LOCALES[settings.language];
  document.documentElement.lang = settings.language; document.documentElement.dir = language.dir || 'ltr';
  document.title = t('appTitle'); document.querySelector('meta[name=description]').content = t('appDescription');
  document.querySelectorAll('[data-t]').forEach(node => { node.textContent = t(node.dataset.t); });
  document.querySelectorAll('[data-t-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.tLabel)); });
  $('language-toggle').querySelector('img').src = `./assets/flags/flag-${language.flag}.svg`;
  $('language-toggle').title = `${t('chooseLanguage')}: ${language.name}`; $('language-toggle').setAttribute('aria-label', $('language-toggle').title);
  for (const option of $('language-options').children) option.setAttribute('aria-selected', String(option.dataset.language === settings.language));
  document.querySelectorAll('[data-legal]').forEach(box => { const copy = strings.legal[box.dataset.legal]; box.hidden = !copy; box.querySelector('.legal-translation-text').textContent = copy || ''; });
  document.querySelectorAll('.dialog-close').forEach(node => { node.setAttribute('aria-label', t('close')); });
  $('settings-open').setAttribute('aria-label', t('settings'));
  $('settings-open').title = t('settings');
  $('help-open').setAttribute('aria-label', updateWorker ? `${t('help')} · ${t('update')}` : t('help'));
  $('help-open').title = t('help');
  $('reef-view-toggle').title=t(reefViewing?'reefReturn':'reefView');
  $('reef-view-toggle').setAttribute('aria-label',$('reef-view-toggle').title);
  $('achievements-nav').setAttribute('aria-label', t('achievements'));
  $('achievements-nav').title = t('achievements');
  $('dark-theme').checked = settings.theme === 'dark';
  $('reduced-motion').checked = settings.reducedMotion; $('show-conflicts').checked = settings.showConflicts; $('tracking').checked = settings.tracking;
  $('sfx-enabled').checked = settings.sfxEnabled; $('sfx-volume').value = Math.round(settings.sfxVolume * 100); renderSfxVolume();
  document.body.dataset.theme = settings.theme; document.body.dataset.reduced = reduced();
  updateBackground();
  $('help-content').className = 'help-copy'; $('help-content').innerHTML = t('helpContent');
  document.querySelectorAll('[data-install-steps]').forEach(node=>node.replaceChildren(...t(node.dataset.installSteps).map(step=>{const item=document.createElement('li');item.textContent=step;return item;})));
  $('app-release-date').dateTime=RELEASE.date;
  $('app-release-date').textContent=new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(RELEASE.date));
  $('release-notes').replaceChildren(...RELEASE.notes[settings.language].map(note=>{const item=document.createElement('li');item.textContent=note;return item;}));
  reefEditor?.renderText();
  $('reef-editor-status').textContent=reefEditor?'':t(['unavailable','awaiting-models'].includes($('reef-aquarium').dataset.status)?'reefUnavailable':'reefLoading');
  if (storageBlocked) { showNotice('storageInvalid'); $('storage-reset').hidden = false; }
  if (readOnly) showNotice('readOnly');
  if (game) $('difficulty').value = game.difficulty;
  renderBoard(); renderAchievements(); music.render();
}
function renderBoard() {
  syncClock();
  $('undo').disabled = !game || !game.history.length || busy || readOnly;
  $('notes').disabled = !game || busy || readOnly; $('erase').disabled = !game || busy || readOnly;
  $('notes').setAttribute('aria-pressed', String(noteMode));
  $('new-game').disabled = busy || readOnly; $('restart-game').disabled = !game || busy || readOnly; $('difficulty').disabled = busy || readOnly;
  for(const id of ['update','settings-update','update-install'])$(id).disabled=busy||readOnly||storageBlocked||!updateWorker;
  document.querySelectorAll('#number-pad button').forEach(button => {
    const n = Number(button.dataset.number), done = Boolean(game && game.values.filter(value => value === n).length >= 9);
    const noted = Boolean(game && !game.values[selection] && game.notes[selection] & (1 << n));
    button.disabled = !game || busy || readOnly;
    button.classList.toggle('is-selected', Boolean(game && game.values[selection] === n));
    button.classList.toggle('is-noted', noted); button.classList.toggle('is-complete', done);
    button.setAttribute('aria-label', [n, done && t('numberDone'), noted && t('noted')].filter(Boolean).join(', '));
  });
  if (!game) return;
  $('board-shell').classList.add('ready');
  const errors = settings.showConflicts ? conflicts(game.values) : new Set();
  cells.forEach((cell, i) => {
    const notes = Array.from({ length: 9 }, (_, n) => n + 1).filter(n => game.notes[i] & (1 << n));
    cell.classList.toggle('is-peer', PEERS[selection].includes(i));
    cell.classList.toggle('is-matching', Boolean(game.values[selection] && game.values[i] === game.values[selection]));
    cell.replaceChildren(); cell.classList.toggle('is-given', Boolean(game.puzzle[i]));
    if (game.values[i]) {
      const value = document.createElement('span'); value.className = 'cell-value'; value.textContent = game.values[i]; value.setAttribute('aria-hidden','true'); cell.append(value);
    } else if (notes.length) {
      const candidates = document.createElement('span'); candidates.className = 'cell-notes'; candidates.setAttribute('aria-hidden','true');
      for (let n = 1; n <= 9; n++) { const value = document.createElement('span'); value.textContent = notes.includes(n) ? n : ''; candidates.append(value); }
      cell.append(candidates);
    }
    cell.tabIndex = i === selection ? 0 : -1;
    cell.setAttribute('aria-selected', String(i === selection)); cell.setAttribute('aria-readonly', String(Boolean(game.puzzle[i] || readOnly)));
    cell.setAttribute('aria-invalid', String(errors.has(i)));
    cell.setAttribute('aria-label', `${t('cell')} ${Math.floor(i / 9) + 1}, ${t('column')} ${i % 9 + 1}, ${game.values[i] || t('empty')}${game.puzzle[i] ? ', ' + t('given') : ''}${notes.length ? ', ' + t('notes') + ' ' + notes.join(', ') : ''}${errors.has(i) ? ', ' + t('conflict') : ''}`);
  });
  const count = game.values.filter(Boolean).length;
  $('remaining').textContent = isSolved(game.values) ? t('completed') : `${81 - count} ${t('remaining')}`;
  scene.updateOptions({ reduced: reduced(), sfxEnabled:settings.sfxEnabled, sfxVolume:settings.sfxVolume });
}
function renderAchievements() {
  for (const [id,value] of [['collection-points',scores.points],['collection-best',scores.best],['collection-solved',scores.solved]]) $(id).textContent = value.toLocaleString(locale());
  $('achievement-count').textContent = progress.unlocked.length;
  $('progress-delete').disabled = readOnly || (!scores.solved && !progress.total); $('tracking').disabled = readOnly || storageBlocked;
  $('achievement-grid').replaceChildren();
  for (const a of ACHIEVEMENTS) {
    const value = Math.min(a.target, progressValue(progress, a)), unlocked = progress.unlocked.includes(a.id);
    const article = document.createElement('article'); article.className = 'achievement' + (unlocked ? ' unlocked' : '');
    const icon = document.createElement('span'); icon.className = 'achievement-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg><use href="#i-${a.icon}"/></svg>`;
    const title = document.createElement('h3'); title.textContent = t('badge.' + a.id);
    const description = document.createElement('p'); description.textContent = t(a.id + 'Condition');
    const meter = document.createElement('progress'); meter.max = a.target; meter.value = value; meter.setAttribute('aria-label', title.textContent);
    const label = document.createElement('small'); label.textContent = !settings.tracking ? t('trackingOff') : unlocked ? t('unlocked') : `${value} / ${a.target}`;
    const rewards=document.createElement('p');rewards.className='achievement-rewards';
    const models=REEF_REWARDS.filter(item=>item.unlock===a.id);
    rewards.hidden=!models.length;rewards.textContent=t('reefRewards')+': '+models.map(item=>t('obj.'+item.id)).join(', ');
    article.append(icon, title, description, meter, label,rewards); $('achievement-grid').append(article);
  }
}
function input(number) {
  if (!game || busy || readOnly) return;
  syncClock();
  const before = fullUnits(game);
  if (!enter(game, selection, number, noteMode && number !== 0)) return;
  const solved = isSolved(game.values), firstWin = solved && !game.completionRecorded;
  const replayed = firstWin && game.credited;
  const fresh = firstWin ? complete(game, progress, settings.tracking, scores) : [];
  persist(); renderBoard(); renderAchievements();
  if (!reduced()) cells[selection].querySelector('.cell-value')?.classList.add('value-pop');
  if (firstWin) {
    $('win-score-status').hidden = !replayed; $('win-score-status').textContent = t('replayScore');
    $('win-points').textContent = game.score.total.toLocaleString(locale());
    $('score-breakdown').replaceChildren();
    for (const [key,label] of [['base','scoreBase'],['time','scoreTime'],['clean','scoreClean'],['direct','scoreDirect'],['milestone','scoreMilestone']]) {
      const name = document.createElement('dt'), value = document.createElement('dd');
      name.textContent = t(label); value.textContent = `+${game.score[key].toLocaleString(locale())}`;
      $('score-breakdown').append(name,value);
    }
    $('new-achievements').replaceChildren();
    for (const a of fresh) {
      const item = document.createElement('div'); item.className = 'new-badge';
      const rewards=REEF_REWARDS.filter(model=>model.unlock===a.id).map(model=>t('obj.'+model.id));
      item.textContent = `${t('newAchievement')}: ${t('badge.' + a.id)}`+(rewards.length?` · ${t('reefRewards')}: ${rewards.join(', ')}`:''); $('new-achievements').append(item);
    }
    scene.playSfx('win'); scene.celebrate(); $('win-dialog').classList.toggle('motion-celebrate', !reduced()); $('win-dialog').showModal(); announce(t('completed'));
  } else {
    const added = fullUnits(game).filter(n => !before.includes(n));
    scene.shimmer(added); scene.playSfx(added.length ? 'unit' : noteMode && number ? 'note' : number ? 'entry' : 'erase');
  }
}
function confirmation(title, copy) {
  return new Promise(resolve => {
    const dialog = $('confirm-dialog');
    if (dialog.open) { resolve(false); return; }
    $('confirm-title').textContent = t(title); $('confirm-copy').textContent = t(copy);
    const finish = value => { dialog.close(); $('confirm-yes').onclick = null; $('confirm-no').onclick = null; dialog.oncancel = null; resolve(value); };
    $('confirm-yes').onclick = () => finish(true); $('confirm-no').onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); }; dialog.showModal(); $('confirm-no').focus();
  });
}
function showWaiting(key) {
  const label=$('loading-label');label.dataset.t=key;label.textContent=t(key);
  if(!$('loading').open)$('loading').showModal();
}
$('loading').addEventListener('cancel',event=>event.preventDefault());
async function newPuzzle(difficulty = $('difficulty').value, ask = true) {
  if (readOnly || busy) return;
  if (ask && game && !isSolved(game.values)) {
    if (!await confirmation('replaceTitle', 'replaceCopy')) { $('difficulty').value = game.difficulty; return; }
  }
  $('settings-dialog').close();
  const hadGame = Boolean(game), token = ++generation; busy = true; renderBoard(); showWaiting('loading');
  scene.stopEffects();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const result = await new Promise(resolve => {
    const worker = new Worker(new URL('./sudoku/worker.mjs', import.meta.url), { type: 'module' });
    const finish = data => { clearTimeout(timer); worker.terminate(); if (workerJob?.worker === worker) workerJob = null; resolve(data); };
    const timer = setTimeout(() => finish(null), 12000); workerJob = { worker, finish };
    worker.onmessage = ({ data }) => finish(data.puzzle || null); worker.onerror = () => finish(null);
    worker.postMessage({ difficulty, seed });
  }).catch(() => null);
  if (token !== generation) return;
  busy = false; $('loading').close();
  if (result && validGame(createGame(result))) {
    game = createGame(result); selection = Math.max(0, game.values.findIndex(v => !v)); noteMode = false;
    $('difficulty').value = difficulty; persist(); announce(t('gameTitle'));
  } else { showNotice('generationFailed'); if (game) $('difficulty').value = game.difficulty; }
  renderBoard();
  if (result && hadGame) scene.playSfx('new');
}
$('new-game').addEventListener('click', () => newPuzzle());
$('restart-game').addEventListener('click', async () => {
  if (!game || busy || readOnly || !await confirmation('restartTitle','restartCopy')) return;
  game = restartGame(game); selection = Math.max(0, game.values.findIndex(v => !v)); noteMode = false;
  scene.stopEffects(); persist(); renderBoard(); renderAchievements(); scene.playSfx('new'); announce(t('restartDone'));
});
$('difficulty').addEventListener('change', () => newPuzzle());
$('win-next').addEventListener('click', () => { $('win-dialog').close(); newPuzzle(game.difficulty, false); });
$('undo').addEventListener('click', () => { if (game && !busy && !readOnly && undo(game)) { persist(); renderBoard(); scene.playSfx('erase'); } });
$('notes').addEventListener('click', () => { noteMode = !noteMode; renderBoard(); });
$('erase').addEventListener('click', () => input(0));
$('board').addEventListener('keydown', event => {
  if (!game || busy) return;
  const row = Math.floor(selection / 9), col = selection % 9;
  const next = { ArrowLeft: row * 9 + Math.max(0, col - 1), ArrowRight: row * 9 + Math.min(8, col + 1), ArrowUp: Math.max(0, row - 1) * 9 + col, ArrowDown: Math.min(8, row + 1) * 9 + col }[event.key];
  if (next !== undefined) { event.preventDefault(); selection = next; renderBoard(); cells[selection].focus(); }
});
document.addEventListener('keydown', event => {
  if (reefEditing || reefViewing || document.querySelector('dialog[open]') || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-9]$/.test(event.key)) { event.preventDefault(); input(Number(event.key)); }
  else if (['Delete','Backspace'].includes(event.key)) { event.preventDefault(); input(0); }
  else if (event.key.toLowerCase() === 'n' && !readOnly && !busy) { noteMode = !noteMode; renderBoard(); }
});
for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
  document.body.addEventListener(type, event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target && !target.closest('input, textarea, select, [contenteditable], #help-dialog .dialog-body')) event.preventDefault();
  });
}
for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, () => screenWake.update(screenActive), { passive:true });
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => {
  const dialog = button.closest('dialog');
  if (dialog.id === 'confirm-dialog') $('confirm-no').click(); else dialog.close();
}));
$('achievements-nav').addEventListener('click', () => { renderAchievements(); $('achievements-dialog').showModal(); });
$('settings-open').addEventListener('click', () => $('settings-dialog').showModal());
function setReefView(active) {
  syncClock();reefViewing=active;document.body.dataset.reefView=String(active);
  $('reef-view-toggle').setAttribute('aria-pressed',String(active));
  $('reef-view-toggle').title=t(active?'reefReturn':'reefView');
  $('reef-view-toggle').setAttribute('aria-label',$('reef-view-toggle').title);
  $('reef-view-actions').hidden=!active;syncClock();
  if(active){scene.stopEffects();$('reef-view-toggle').focus();}else cells[selection].focus();
}
$('reef-view-toggle').addEventListener('click',()=>setReefView(!reefViewing));
$('help-open').addEventListener('click', () => $('help-dialog').showModal());
// The welcome click is the user gesture that lets the reef music start.
// The rule steps point at the row, column and box of one empty square that the tour also solves.
const boxOf = i => Math.floor(i / 27) * 3 + Math.floor(i % 9 / 3);
const fits = i => [1,2,3,4,5,6,7,8,9].filter(n => !PEERS[i].some(peer => game.values[peer] === n));
const TOUR = [
  ['tourIntro', () => [$('board-shell')]],
  ['tourRow', () => cells.filter((_, i) => Math.floor(i / 9) === Math.floor(selection / 9))],
  ['tourColumn', () => cells.filter((_, i) => i % 9 === selection % 9)],
  ['tourBox', () => cells.filter((_, i) => boxOf(i) === boxOf(selection))],
  ['tourGiven', () => game ? cells.filter((_, i) => game.puzzle[i]) : []],
  ['tourSolve', () => game && !game.values[selection] ? [cells[selection]] : []],
  ['tourPad', () => [$('number-pad')]], ['tourNotes', () => [$('notes')]], ['tourTools', () => [document.querySelector('.game-tools')]],
  ['tourFocus', () => [cells[selection]], () => {document.body.dataset.tourColors='true';}],
  ['tourMatching', () => cells.filter(cell=>cell.classList.contains('is-matching')), () => {
    selection=Math.max(0,game.values.findIndex(Boolean));renderBoard();document.body.dataset.tourColors='true';
  }],
  ['tourErrors', () => [cells[tourError]], () => {
    const given=game.values.findIndex(Boolean);tourError=PEERS[given].find(i=>!game.values[i]&&i!==selection)??selection;
    const cell=cells[tourError],value=document.createElement('span');value.className='cell-value';value.textContent=game.values[given];
    cell.replaceChildren(value);cell.setAttribute('aria-selected','false');cell.setAttribute('aria-invalid','true');cell.setAttribute('aria-label',t('tourErrorsTitle')+': '+value.textContent);
    document.body.dataset.tourColors='true';
  }],
  ['tourPadColors', () => [$('number-pad')], () => {
    const buttons=[...$('number-pad').children];buttons.forEach(button=>button.classList.remove('is-selected','is-noted','is-complete'));
    buttons[0].classList.add('is-selected');buttons[1].classList.add('is-noted');buttons[2].classList.add('is-complete');
  }],
  ['tourStats', () => [document.querySelector('.round-stats')]], ['tourReef', () => [$('reef-view-toggle')]],
  ['tourEditorIntro', () => [document.querySelector('.reef-editor-top')]],
  ['tourEditorSelect', () => [$('reef-object-tools')], () => aquarium.select(tourFish)],
  ['tourEditorMove', () => [document.querySelector('[data-reef-mode="move"]')], () => reefEditor.setMode('move')],
  ['tourEditorHeight', () => [document.querySelector('[data-reef-mode="height"]')], () => reefEditor.setMode('height')],
  ['tourEditorRotate', () => [...document.querySelectorAll('[data-reef-mode^="rotate"]')], () => reefEditor.setMode('rotate')],
  ['tourEditorScale', () => [document.querySelector('[data-reef-mode="scale"]')], () => reefEditor.setMode('scale')],
  ['tourEditorObjects', () => [$('reef-duplicate'),$('reef-remove')]],
  ['tourEditorColor', () => [document.querySelector('[data-reef-slider="hue"]')], () => reefEditor.setSlider('hue')],
  ['tourEditorSpeed', () => [document.querySelector('[data-reef-slider="speed"]')], () => reefEditor.setSlider('speed')],
  ['tourEditorRadius', () => [document.querySelector('[data-reef-slider="radius"]')], () => reefEditor.setSlider('radius')],
  ['tourEditorFish', () => [document.querySelector('[data-reef-slider="motion"]')], () => reefEditor.setSlider('motion')],
  ['tourEditorDone', () => [$('reef-deselect')]],
  ['tourEditorAdd', () => [$('reef-add-type')], () => aquarium.select(null)],
  ['tourEditorCatalog', () => [$('reef-picker-dialog')], () => reefEditor.showPicker(false)],
  ['tourEditorList', () => [$('reef-list-actions')], () => {
    reefEditor.showPicker(true);const check=$('reef-picker').querySelector('input');check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
  }],
  ['tourEditorUndo', () => [$('reef-undo')]], ['tourEditorReset', () => [$('reef-reset')]],
  ['tourEditorHints', () => [$('reef-hint-close')], () => {$('reef-hint').style.display='flex';}],
  ['tourEditorSave', () => [$('reef-finish'),$('reef-cancel')]],
  ['tourAchievements', () => [$('achievements-nav')]], ['tourSettings', () => [$('settings-open')]], ['tourHelp', () => [$('help-open')]],
];
let tour = [], tourStep = 0, tourTargets = [], tourSelection=selection, tourError=0, tourFish=null, tourEditorActive=false;
async function startTour() {
  const dialog=$('tour-dialog');showWaiting('reefLoading');
  await aquariumReady;
  $('loading').close();dialog.showModal();
  if (game) {
    const open = game.values.flatMap((value, i) => value ? [] : [i]);
    if (open.length) selection = open.reduce((best, i) => fits(i).length < fits(best).length ? i : best);
    renderBoard();
  }
  tourSelection=selection;
  tour = TOUR.filter(([key, targets, prepare]) => key.startsWith('tourEditor') ? reefEditor&&!readOnly : prepare ? Boolean(game) : targets().some(node => node?.getClientRects().length));
  tourStep = 0;$('tour-next').disabled=false;showTourStep();
}
function placeTour() {
  if (!$('tour-dialog').open || !tourTargets.length) return;
  const bubble = $('tour-bubble'), rects = tourTargets.map(node => node.getBoundingClientRect()), pad = 6, gap = 16, edge = 12;
  const target = { top:Math.min(...rects.map(r => r.top)), bottom:Math.max(...rects.map(r => r.bottom)), left:Math.min(...rects.map(r => r.left)), right:Math.max(...rects.map(r => r.right)) };
  const room=Math.max(target.top-pad-gap-edge,innerHeight-target.bottom-pad-gap-edge);
  bubble.style.maxHeight=(room>=180?Math.min(innerHeight-edge*2,room):innerHeight-edge*2)+'px';
  const box=bubble.getBoundingClientRect();
  Object.assign($('tour-spotlight').style, { top:target.top-pad+'px', left:target.left-pad+'px', width:target.right-target.left+pad*2+'px', height:target.bottom-target.top+pad*2+'px' });
  const wanted = innerHeight - target.bottom >= target.top ? target.bottom + pad + gap : target.top - pad - gap - box.height;
  const top = Math.min(innerHeight - box.height - edge, Math.max(edge, wanted));
  const left = Math.min(innerWidth - box.width - edge, Math.max(edge, (target.left + target.right) / 2 - box.width / 2));
  bubble.style.top = top+'px'; bubble.style.left = left+'px';
  bubble.dataset.arrow = top >= target.bottom + pad ? 'up' : top + box.height <= target.top - pad ? 'down' : '';
  bubble.style.setProperty('--arrow-x', Math.min(box.width-26,Math.max(26,(target.left+target.right)/2-left))+'px');
}
function showTourStep() {
  for (const node of tourTargets) node.classList.remove('tour-target');
  delete document.body.dataset.tourColors;$('reef-hint').style.removeProperty('display');
  selection=tourSelection;renderBoard();
  const dialog = $('tour-dialog'), step = tour[tourStep],editor=step?.[0].startsWith('tourEditor');
  if(!editor&&tourEditorActive){reefEditor.finish(false);tourEditorActive=false;tourFish=null;}
  if (!step) { tourTargets = [];dialog.close();cells[selection].focus();return; }
  if(editor){
    if(!tourEditorActive){
      reefEditor.start();aquarium.setLayout(aquarium.defaultLayout);
      tourFish=aquarium.addObject('clownfish',{x:0,y:2.8,z:-6,scale:1.2,motion:'still'});aquarium.select(null);tourEditorActive=true;
    }
    dialog.close();
    reefEditor.setSlider(null);
    if(!['tourEditorCatalog','tourEditorList'].includes(step[0]))$('reef-picker-dialog').close();
  }
  step[2]?.();
  tourTargets=step[1]().filter(node=>node?.getClientRects().length);
  if(!tourTargets.length)tourTargets=[editor?$('reef-editor'):$('board-shell')];
  for (const node of tourTargets) node.classList.add('tour-target');
  let copy = t(step[0]);
  if (step[0] === 'tourSolve') { const left = fits(selection); copy += ' ' + (left.length === 1 ? t('tourSolveOne').replace('{n}', left[0]) : t('tourSolveMany').replace('{list}', left.join(', '))); }
  dialog.dataset.step=step[0];
  $('tour-step').textContent = t('tourStep').replace('{n}', tourStep + 1).replace('{total}', tour.length);
  $('tour-title').textContent = t(step[0] + 'Title'); $('tour-copy').textContent = copy;
  $('tour-next').textContent = t(tourStep === tour.length - 1 ? 'tourDone' : 'tourNext');
  if (!dialog.open) dialog.showModal();
  placeTour();requestAnimationFrame(placeTour);$('tour-next').focus();
}
async function enterApp(action) {
  if(navigator.serviceWorker?.controller)await startupUpdateCheck;
  if($('update-dialog').open)await new Promise(resolve=>$('update-dialog').addEventListener('close',resolve,{once:true}));
  action();
}
$('welcome-start').addEventListener('click', () => enterApp(async()=>{
  $('welcome-dialog').close();
  if(!aquarium){showWaiting('reefLoading');await aquariumReady;$('loading').close();}
  cells[selection].focus();
}));
$('welcome-tour').addEventListener('click', () => enterApp(()=>{ $('welcome-dialog').close(); startTour(); }));
const appWindow=matchMedia('(display-mode: standalone)');
let appInstalled=false,installPrompt=null;
const updateInstallButton=()=>{ $('welcome-install').hidden=appInstalled||appWindow.matches||navigator.standalone===true; };
appWindow.addEventListener('change',updateInstallButton);
// Chromium offers its own install dialog; other browsers keep the written guide.
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{appInstalled=true;installPrompt=null;updateInstallButton();});
updateInstallButton();
const openInstallGuide=()=>enterApp(()=>{ $('welcome-dialog').close(); $('install-guide').open=true; $('help-dialog').showModal(); $('install-title').focus(); $('install-guide').scrollIntoView({block:'start'}); });
$('welcome-install').addEventListener('click', () => {
  // The prompt must start within the click, before enterApp waits for updates.
  const prompt=installPrompt;installPrompt=null;
  if(prompt)prompt.prompt().catch(openInstallGuide);
  else void openInstallGuide();
});
$('help-tour').addEventListener('click', () => { $('help-dialog').close(); if (reefViewing) setReefView(false); startTour(); });
$('tour-next').addEventListener('click', () => { tourStep++; showTourStep(); });
$('tour-skip').addEventListener('click', () => { tourStep = tour.length; showTourStep(); });
$('tour-dialog').addEventListener('cancel', event => { event.preventDefault(); $('tour-skip').click(); });
window.addEventListener('resize', placeTour);
$('help-dialog').addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const section = [...$('help-dialog').querySelectorAll('details[data-document]')].find(details => new URL(details.dataset.document, location.href).href === link.href);
  if (!section) return;
  event.preventDefault(); $('legal-guide').open = true; section.open = true; section.querySelector('summary').focus();
});
function changeSettings() {
  if (readOnly) { renderText(); return; }
  settings.theme = $('dark-theme').checked ? 'dark' : 'light';
  settings.reducedMotion = $('reduced-motion').checked; settings.showConflicts = $('show-conflicts').checked;
  renderText(); persist();
}
for (const id of ['dark-theme','reduced-motion','show-conflicts']) $(id).addEventListener('change', changeSettings);
function showLanguages(open) {
  $('language-options').hidden = !open; $('language-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('language-options').querySelector('[aria-selected=true]').focus();
}
$('language-options').append(...Object.entries(LOCALES).map(([code, { name, flag }]) => {
  const option = document.createElement('button'), image = document.createElement('img');
  option.type = 'button'; option.setAttribute('role', 'option'); option.dataset.language = code; option.lang = code; option.title = name; option.setAttribute('aria-label', name);
  image.src = `./assets/flags/flag-${flag}.svg`; image.alt = ''; image.className = 'flag'; option.append(image); return option;
}));
$('language-toggle').addEventListener('click', () => showLanguages($('language-options').hidden));
$('language-toggle').addEventListener('keydown', event => { if (['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); showLanguages(true); } });
$('language-options').addEventListener('keydown', event => {
  const options = [...$('language-options').children], index = options.indexOf(document.activeElement);
  const columns = getComputedStyle($('language-options')).gridTemplateColumns.split(' ').length, side = document.documentElement.dir === 'rtl' ? -1 : 1;
  const step = { ArrowRight:side, ArrowLeft:-side, ArrowDown:columns, ArrowUp:-columns }[event.key];
  if (event.key === 'Escape') { event.preventDefault(); showLanguages(false); $('language-toggle').focus(); }
  else if (event.key === 'Tab') showLanguages(false);
  else if (step || ['Home','End'].includes(event.key)) {
    event.preventDefault();
    options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + step + options.length) % options.length].focus();
  }
});
$('language-options').addEventListener('click', async event => {
  const code = event.target.closest('[data-language]')?.dataset.language;
  if (!code) return;
  showLanguages(false); $('language-toggle').focus();
  if (readOnly || code === settings.language) return;
  const request = ++languageRequest, next = await loadStrings(code);
  if (request !== languageRequest) return;
  settings.language = code; strings = next; renderText(); persist();
});
document.addEventListener('click', event => { if (!event.target.closest('.language-picker')) showLanguages(false); });
$('settings-dialog').addEventListener('close', () => showLanguages(false));
for (const id of ['imprint','privacy','code','notices','music','sounds','commons']) {
  const box = document.createElement('div'); box.className = 'legal-translation'; box.dataset.legal = id; box.hidden = true;
  box.innerHTML = '<p class="legal-translation-note" data-t="legalTranslationNote"></p><div class="legal-translation-text"></div><p class="legal-original-label" data-t="legalOriginal"></p>';
  $('legal-' + id).querySelector('.legal-document').prepend(box);
}
$('sfx-enabled').addEventListener('change', () => { settings.sfxEnabled = $('sfx-enabled').checked; renderBoard(); persist(); });
$('sfx-volume').addEventListener('input', () => { settings.sfxVolume = Number($('sfx-volume').value) / 100; renderSfxVolume(); renderBoard(); persist(); });
$('sfx-volume').addEventListener('change', () => scene.playSfx('achievement'));
document.addEventListener('click', event => { if (event.target.closest('button') && !event.target.closest('.cell, #number-pad, #undo, #erase, #new-game, #win-next')) scene.playSfx('menu'); });
$('tracking').addEventListener('change', async () => {
  if (readOnly || storageBlocked) return;
  if (!$('tracking').checked && progress.total > 0 && !await confirmation('stopTrackingTitle', 'stopTrackingCopy')) { $('tracking').checked = true; return; }
  settings.tracking = $('tracking').checked;
  if (!settings.tracking) progress = emptyProgress();
  persist(); renderBoard(); renderAchievements();
});
$('progress-delete').addEventListener('click', async () => {
  if (!readOnly && await confirmation('deleteTitle', 'deleteCopy')) { progress = emptyProgress(); scores = emptyScores(); persist(); renderBoard(); renderAchievements(); }
});
$('storage-reset').addEventListener('click', async () => {
  if (!readOnly && await confirmation('resetTitle', 'resetCopy')) { storageBlocked = false; $('notice').hidden = true; $('storage-reset').hidden = true; persist(); renderAchievements(); }
});
media.addEventListener('change', () => { document.body.dataset.reduced = reduced(); updateBackground(); renderBoard(); });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  if (readOnly) { const fresh = load(); if (fresh.game) { game = fresh.game; progress = fresh.progress; scores = fresh.scores; renderBoard(); renderAchievements(); } }
});
window.addEventListener('pagehide', () => { syncClock(); persist(); screenWake.update(false); workerJob?.worker.terminate(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
document.addEventListener('visibilitychange', () => { syncClock(); if (document.hidden) { persist(); scene.stopEffects(); } });
const dialogClock = new MutationObserver(syncClock);
document.querySelectorAll('dialog').forEach(dialog => dialogClock.observe(dialog, { attributes:true, attributeFilter:['open'] }));
setInterval(() => { syncClock(); if (clockActive && ++clockTicks % 5 === 0) persist(); }, 1000);
async function acquireWriter() {
  if (!navigator.locks) return;
  readOnly = !await new Promise(resolve => {
    navigator.locks.request('marenssudoku:writer', { ifAvailable: true }, async lock => {
      resolve(Boolean(lock));
      if (lock) await new Promise(release => window.addEventListener('pagehide', release, { once: true }));
    }).catch(() => resolve(false));
  });
  if (readOnly) showNotice('readOnly');
}
async function offlineSetup() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration()||await navigator.serviceWorker.register('./sw.js');
    const offer = async () => {
      if(!navigator.serviceWorker.controller)return;
      const worker=registration.waiting||registration.active;if(!worker)return;
      const result=await workerMessage(worker,{type:'CHECK_UPDATE',build:$('app-version').dataset.build});if(!result.available)return;
      if(worker!==(registration.waiting||registration.active))return offer();
      updateWorker=worker;
      for(const id of ['update-notice','update-badge','settings-update-notice'])$(id).hidden=false;
      renderText();
      if($('welcome-dialog').open&&!updatePrompted&&!readOnly&&!storageBlocked){
        updatePrompted=true;$('update-dialog').showModal();
      }
    };
    const watch=()=>registration.installing?.addEventListener('statechange',()=>{void offer().catch(()=>{});});
    watch();registration.addEventListener('updatefound',watch);
    void registration.update().catch(()=>{});
    await offer();
  } catch {}
}
function workerMessage(worker,message) {
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('Update worker did not respond'));},5000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
    try{worker.postMessage(message,[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
  });
}
function updateError(key) {
  const node=$('update-dialog-error');node.dataset.t=key;node.textContent=t(key);node.hidden=false;
  if(!$('update-dialog').open)$('update-dialog').showModal();
}
async function applyUpdate() {
  const worker=updateWorker;
  if(!worker||busy||readOnly||storageBlocked)return;
  syncClock();
  if(!save(game,settings,progress,scores)){
    updateError('updateSaveFailed');
    return;
  }
  showWaiting('updating');
  try{if((await workerMessage(worker,'APPLY_UPDATE')).ok){location.reload();return;}}catch{}
  $('loading').close();
  updateError('updateFailed');
}
for(const id of ['update','settings-update','update-install'])$(id).addEventListener('click',applyUpdate);
$('update-dialog').addEventListener('cancel',event=>{event.preventDefault();$('update-dialog').close();});
renderText();
const firstVisit=!state.game&&!state.problem;
$('welcome-dialog').classList.toggle('first-visit',firstVisit);
await acquireWriter();
$('welcome-dialog').showModal();
renderBoard();
if (game) { persist(); }
else if (!readOnly) newPuzzle('easy', false);
startupUpdateCheck=offlineSetup();
aquariumReady=import('./game/aquarium.mjs').then(module => module.createAquarium($('reef-aquarium'))).then(result => {
  aquarium=result;updateBackground();
  if(!result){$('reef-editor-status').textContent=t('reefUnavailable');return;}
  reefEditor=setupReefEditor(result,{t,readOnly,
    unlocked:()=>progress.unlocked,
    async prepareObject(type){
      if(result.hasObjectType(type))return;
      showWaiting('reefLoading');
      try{await result.prepareObject(type);}finally{$('loading').close();}
    },
    confirmReset:()=>confirmation('reefResetTitle','reefResetCopy'),
    onModeChange(active){syncClock();reefEditing=active;syncClock();if(active)scene.stopEffects();else if(reefViewing)$('reef-view-toggle').focus();else cells[selection].focus();},
  });
}).catch(() => { $('reef-aquarium').dataset.status = 'unavailable'; $('reef-editor-status').textContent=t('reefUnavailable'); });
