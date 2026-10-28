import { createBoard } from './game/board.mjs';
import { conflicts, isSolved } from './sudoku/engine.mjs';
import { createGame, enter, undo, fullUnits, complete, emptyProgress, progressValue, ACHIEVEMENTS, validGame } from './sudoku/model.mjs';
import { load, save, STORAGE_KEY } from './storage.mjs';
import { setupMusic } from './music.mjs';

const $ = id => document.getElementById(id);
const text = {
  de: {
    brandSub:'DEINE KLEINE RIFFPAUSE', play:'Spielen', achievements:'Erfolge', settings:'Deine Einstellungen',
    eyebrow:'EIN KLEINER MOMENT FÜR DICH', heroFirst:'Tauch kurz ab.', heroSecond:'Blüh wieder auf.',
    heroCopy:'Kristallklares Wasser. Bunte Gedanken. Und immer ein neues Sudoku, das auf dich wartet.',
    fishCaption:'Eine Perle nach der anderen.', treasureTitle:'Dein kleiner Perlenschatz', treasureCopy:'Entdecke deine Erfolge im Riff.',
    gameOverline:'DEIN MOMENT. DEIN TEMPO.', autosave:'Automatisch gespeichert', gameTitle:'Eine kleine Riffpause', puzzleDescription:'81 Felder. Meer Möglichkeiten.',
    difficulty:'Schwierigkeit', easy:'Leicht', medium:'Mittel', hard:'Schwer', loading:'Dein nächstes Rätsel taucht auf …', cancel:'Abbrechen', confirm:'Bestätigen',
    undo:'Zurück', notes:'Notizen', erase:'Löschen', newGame:'Neues Sudoku', keyboardHint:'Mit Pfeiltasten navigieren · Zahlen 1–9 · N für Notizen',
    footer:'Ein kleines Meer voller Möglichkeiten.', help:'Hilfe & Infos', update:'Update verfügbar', language:'Sprache',
    darkTheme:'Abend im Riff', darkThemeHelp:'Dunkle Farben für eine ruhige Abendrunde.', reduceMotion:'Bewegung reduzieren',
    musicTitle:'Riffmusik', musicTrack:'Titel', musicVolume:'Lautstärke', musicStart:'Musik starten', musicPause:'Musik pausieren', musicPlaying:'Es spielt',
    musicHelp:'Zufällige Riffmusik ohne direkte Wiederholung. Pause gilt bis zum Neuladen; die Lautstärke bleibt gespeichert.', musicAwaiting:'Musik ist aktiv. Tippe ins Spiel, damit dein Browser die Wiedergabe startet.', musicError:'Die Musik konnte nicht gestartet werden. Bitte erneut versuchen oder einen anderen Titel wählen.',
    sfxTitle:'Riffklänge', sfxEnabled:'Soundeffekte', sfxHelp:'Sanfte Klänge für Eingaben und kleine Erfolge.', testSound:'Klang testen',
    reduceMotionHelp:'Ruhige Markierungen statt bewegter Effekte.', showConflicts:'Konflikte markieren', showConflictsHelp:'Zeigt doppelte Zahlen in Reihe, Spalte oder Block.',
    collection:'DEINE SAMMLUNG', achievementsCopy:'Jedes Rätsel ist ein kleiner Tauchgang. Sammle deine schönsten Entdeckungen.',
    trackAchievements:'Erfolge und Punkte auf diesem Gerät speichern', trackingHelp:'Freiwillig und nur lokal: gelöste Rätsel, Gesamtpunkte, Bestwert und Abzeichen. Beim Ausschalten wird diese Sammlung nach Bestätigung gelöscht.',
    points:'Punkte', totalPoints:'Gesamtpunkte', roundPoints:'Rundenpunkte', bestRound:'Bestes Rätsel', solvedPuzzles:'Gelöste Rätsel', activeTime:'Aktive Spielzeit', scoreHow:'Wie entstehen die Punkte?',
    scoreBase:'Grundpunkte', scoreTime:'Zeitbonus', scoreClean:'Ohne falsche Zahl', scoreDirect:'Ohne Rückgängig', scoreMilestone:'Jedes fünfte Rätsel',
    scoreRules:'Leicht: 1.000, Mittel: 2.000, Schwer: 3.000 Grundpunkte. Dazu bis zu 50 % Zeitbonus, der über 10 / 20 / 40 aktive Minuten auf null sinkt. Ohne falsche Zahl +20 %, ohne Rückgängig +10 %. Jedes fünfte gespeicherte Rätsel bringt weitere 500 Punkte. Notizen zählen nicht als Fehler. Punkte gibt es einmalig beim Lösen; Grundpunkte bleiben auch bei langen Runden erhalten. Zeit pausiert in Menüs und im Hintergrund. Gesamtpunkte und Bestwert werden nur mit aktivierter Erfolgsspeicherung gesammelt. Für bereits begonnene Rätsel startet die Zeitmessung mit diesem Update.',
    deleteProgress:'Sammlung und Punkte löschen', winEyebrow:'EINE KLEINE MEISTERLEISTUNG', winTitle:'Strahlend gelöst!',
    winCopy:'Alle Zahlen haben ihren Platz gefunden. Deine nächste Riffpause wartet schon.', winNext:'Weiter durchs Riff',
    resetStorage:'Speicher zurücksetzen', storageInvalid:'Dein gespeicherter Stand konnte nicht sicher geladen werden. Er bleibt erhalten. Dieses Spiel wird vorerst nicht gespeichert.',
    storageFailed:'Dein Browser kann gerade nicht speichern. Du kannst weiterspielen; sichere deinen Fortschritt durch Offenlassen dieses Fensters.',
    unsaved:'Nicht gespeichert', readOnly:'Schon in einem anderen Fenster geöffnet. Dieses Fenster zeigt den Stand schreibgeschützt. Für die Bearbeitung danach neu laden.',
    offlineReady:'Offline bereit', offlinePreparing:'Offline-Dateien werden vorbereitet', generationFailed:'Dieses Rätsel konnte nicht erstellt werden. Bitte noch einmal versuchen.',
    replaceTitle:'Ein neuer Tauchgang?', replaceCopy:'Dein aktuelles Sudoku wird durch ein neues ersetzt. Dein bisheriger Erfolgsfortschritt bleibt erhalten.',
    deleteTitle:'Perlenschatz zurücksetzen?', deleteCopy:'Gesamtpunkte, Bestwert, Erfolgszähler und Abzeichen werden auf diesem Gerät gelöscht. Dein Sudoku bleibt erhalten.',
    stopTrackingTitle:'Erfolgsspeicherung ausschalten?', stopTrackingCopy:'Damit werden Gesamtpunkte, Bestwert, Erfolgszähler und Abzeichen auf diesem Gerät gelöscht. Dein Sudoku bleibt erhalten.',
    resetTitle:'Gespeicherten Stand ersetzen?', resetCopy:'Der bisher nicht lesbare lokale Spielstand wird durch das hier angezeigte Spiel ersetzt.',
    unlocked:'Freigeschaltet', trackingOff:'Speicherung aus', filled:'Felder gefüllt', remaining:'Felder warten noch auf dich', completed:'Alle 81 Felder gelöst. Gut gemacht!',
    firstCondition:'Eine Runde lösen', flowCondition:'10 Runden lösen', magicCondition:'50 Runden lösen', starsCondition:'100 Runden lösen', varietyCondition:'Jede Schwierigkeit einmal lösen', crownCondition:'5 schwere Runden lösen', directCondition:'Eine Runde ohne Rückgängig lösen',
    close:'Schließen', cell:'Reihe', column:'Spalte', given:'Vorgegeben', empty:'Leer', conflict:'Regelkonflikt', newAchievement:'Neuer Erfolg',
    helpContent:'<h3>So tauchst du ein</h3><p>Fülle jede Reihe, jede Spalte und jeden 3×3-Block mit den Zahlen 1–9. Jede Zahl kommt darin genau einmal vor. Die vorgegebenen Zahlen bleiben unverändert.</p><p>Tippe auf ein Feld und dann auf eine Zahl. Im Notizmodus sammelst du mögliche Zahlen. Zurück nimmt deinen letzten Zug einschließlich seiner Notizen zurück. Doppelte Zahlen werden auf Wunsch markiert.</p><h3>Dein Spiel bleibt bei dir</h3><p>Spielstand und Einstellungen werden lokal in diesem Browser gespeichert. Erfolge werden erst nach Aktivierung gespeichert. Beim Löschen der Websitedaten, auf einem anderen Gerät oder unter einer anderen Adresse steht dieser Fortschritt nicht zur Verfügung.</p><p>Nach der Anzeige „Offline bereit“ kannst du dieselbe Adresse ohne Internet öffnen und neue Rätsel erzeugen. Updates werden erst nach deiner Bestätigung aktiviert.</p><h3>Offenes Projekt</h3><p>MarensSudoku 0.1.0 · Phaser 4.2.1. Eigener Code und Dokumentation unter MIT. Generierte Grafikassets haben dokumentierte Herkunft; eine exklusive Schutzfähigkeit wird nicht zugesichert.</p><p><a href="https://github.com/MarensSudoku/MarensSudoku.github.io" target="_blank" rel="noopener noreferrer">Quellcode auf GitHub</a> · <a href="./LICENSE.txt" target="_blank">MIT-Lizenz</a> · <a href="./THIRD_PARTY_NOTICES.txt" target="_blank">Fremdlizenzen</a></p><h3>Rechtliches</h3><p><a href="./impressum.html">Impressum</a> · <a href="./datenschutz.html">Datenschutz</a> · <a href="./assets/music/LICENSE.txt">Musiklizenz</a> · <a href="./assets/sounds/LICENSE.txt">Soundlizenz</a></p>',
  },
  en: {
    brandSub:'YOUR LITTLE REEF BREAK', play:'Play', achievements:'Achievements', settings:'Your preferences',
    eyebrow:'A LITTLE MOMENT FOR YOU', heroFirst:'Dive into calm.', heroSecond:'Come up smiling.', heroCopy:'Crystal-clear water. Colourful thoughts. And a new Sudoku whenever you fancy one.',
    fishCaption:'One little pearl at a time.', treasureTitle:'Your little pearl collection', treasureCopy:'Discover your achievements in the reef.',
    gameOverline:'YOUR MOMENT. YOUR PACE.', autosave:'Saved automatically', gameTitle:'A little reef break', puzzleDescription:'81 squares. An ocean of possibilities.',
    difficulty:'Difficulty', easy:'Easy', medium:'Medium', hard:'Hard', loading:'Your next puzzle is surfacing …', cancel:'Cancel', confirm:'Confirm',
    undo:'Undo', notes:'Notes', erase:'Erase', newGame:'New Sudoku', keyboardHint:'Arrow keys to move · Numbers 1–9 · N for notes', footer:'A little ocean of possibilities.',
    help:'Help & info', update:'Update available', language:'Language', darkTheme:'Evening at the reef', darkThemeHelp:'Dark colours for a quiet evening puzzle.',
    reduceMotion:'Reduce motion', reduceMotionHelp:'Quiet highlights instead of moving effects.', showConflicts:'Highlight conflicts', showConflictsHelp:'Marks duplicate numbers in rows, columns or boxes.',
    musicTitle:'Reef music', musicTrack:'Track', musicVolume:'Volume', musicStart:'Start music', musicPause:'Pause music', musicPlaying:'Now playing',
    musicHelp:'Random reef music without consecutive repeats. Pause lasts until reload; your volume is saved.', musicAwaiting:'Music is enabled. Tap the game to let your browser start playback.', musicError:'Music could not start. Please try again or choose another track.',
    sfxTitle:'Reef sounds', sfxEnabled:'Sound effects', sfxHelp:'Gentle sounds for moves and little achievements.', testSound:'Test sound',
    collection:'YOUR COLLECTION', achievementsCopy:'Every puzzle is a little dive. Collect your favourite discoveries.', trackAchievements:'Save achievements and points on this device',
    trackingHelp:'Optional and local only: solved puzzles, total points, personal best and badges. Turning this off deletes this collection after confirmation.', deleteProgress:'Delete collection and points',
    points:'points', totalPoints:'Total points', roundPoints:'Round points', bestRound:'Personal best', solvedPuzzles:'Solved puzzles', activeTime:'Active play time', scoreHow:'How do points work?',
    scoreBase:'Base points', scoreTime:'Time bonus', scoreClean:'No wrong entries', scoreDirect:'No undo', scoreMilestone:'Every fifth puzzle',
    scoreRules:'Easy: 1,000, Medium: 2,000, Hard: 3,000 base points. Earn up to 50% time bonus, decreasing to zero over 10 / 20 / 40 active minutes. No wrong entries adds 20%, no undo adds 10%. Every fifth saved puzzle earns another 500 points. Notes do not count as mistakes. Points are awarded once on completion; base points remain even for long rounds. Time pauses in menus and in the background. Total points and personal best are collected only with achievement saving enabled. Existing puzzles start timing from this update.',
    winEyebrow:'A LITTLE MOMENT OF BRILLIANCE', winTitle:'Beautifully solved!', winCopy:'Every number has found its place. Your next reef break is waiting.', winNext:'Explore another puzzle',
    resetStorage:'Reset storage', storageInvalid:'Your saved game could not be safely loaded. It remains untouched. This game will not be saved for now.',
    storageFailed:'Your browser cannot save right now. You can keep playing; keep this window open to retain your current progress.', unsaved:'Not saved',
    readOnly:'Already open in another window. This window is read-only. Reload after closing the other window to edit.', offlineReady:'Ready offline', offlinePreparing:'Preparing offline files',
    generationFailed:'This puzzle could not be created. Please try again.', replaceTitle:'Ready for another dive?', replaceCopy:'A new Sudoku will replace your current puzzle. Your achievement progress will stay.',
    deleteTitle:'Reset your pearl collection?', deleteCopy:'Total points, personal best, achievement counts and badges will be deleted on this device. Your Sudoku will stay.',
    stopTrackingTitle:'Turn off achievement saving?', stopTrackingCopy:'Your total points, personal best, achievement counts and badges will be deleted on this device. Your Sudoku will stay.',
    resetTitle:'Replace the saved game?', resetCopy:'The unreadable local save will be replaced by the game currently shown here.', unlocked:'Unlocked', trackingOff:'Saving off',
    filled:'squares filled', remaining:'squares left to discover', completed:'All 81 squares solved. Beautiful work!',
    firstCondition:'Solve one round', flowCondition:'Solve 10 rounds', magicCondition:'Solve 50 rounds', starsCondition:'Solve 100 rounds', varietyCondition:'Solve every difficulty once', crownCondition:'Solve 5 hard rounds', directCondition:'Solve a round without undo',
    close:'Close', cell:'Row', column:'column', given:'Given', empty:'Empty', conflict:'Rule conflict', newAchievement:'New achievement',
    helpContent:'<h3>Take a little dive</h3><p>Fill each row, column and 3×3 box with the numbers 1–9, using each number exactly once. Given numbers cannot be changed.</p><p>Select a square and then a number. Use notes to collect candidates. Undo restores your previous move and its notes. Duplicate numbers can be highlighted.</p><h3>Your game stays with you</h3><p>Your game and preferences are saved locally in this browser. Achievement saving is optional. Clearing site data, changing devices or changing the address can remove access to your progress.</p><p>Once “Ready offline” appears, reopen the same address without internet and generate new puzzles. Updates are activated only after your confirmation.</p><h3>Open project</h3><p>MarensSudoku 0.1.0 · Phaser 4.2.1. Original code and documentation are MIT licensed. Generated graphics have documented provenance; exclusive copyright protection is not guaranteed.</p><p><a href="https://github.com/MarensSudoku/MarensSudoku.github.io" target="_blank" rel="noopener noreferrer">Source on GitHub</a> · <a href="./LICENSE.txt" target="_blank">MIT licence</a> · <a href="./THIRD_PARTY_NOTICES.txt" target="_blank">Third-party notices</a></p><h3>Legal</h3><p><a href="./impressum.html">Legal notice</a> · <a href="./datenschutz.html">Privacy</a> · <a href="./assets/music/LICENSE.txt">Music licence</a> · <a href="./assets/sounds/LICENSE.txt">Sound licence</a></p>',
  },
};
const state = load();
let game = state.game, progress = state.progress, settings = state.settings;
let storageBlocked = state.problem, readOnly = false, busy = false, noteMode = false;
let selection = game ? Math.max(0, game.values.findIndex(v => !v)) : 0;
let workerJob = null, generation = 0, offline = false, waitingRegistration = null;
let clockAt = performance.now(), clockGame = null, clockActive = false, clockTicks = 0;
const media = matchMedia('(prefers-reduced-motion: reduce)');
const t = key => text[settings.language][key] || text.de[key] || key;
const reduced = () => settings.reducedMotion || media.matches;
const background = $('reef-background-video');
background.muted = true; background.defaultMuted = true; background.volume = 0;
background.addEventListener('volumechange', () => { if (!background.muted || background.volume !== 0) { background.muted = true; background.volume = 0; } });
function updateBackground() { if (reduced()) background.pause(); else background.play().catch(() => {}); }
const music = setupMusic(settings, t, persist);
const { scene, engine } = createBoard('phaser-board');
scene.onReady = () => { $('board-shell').classList.add('ready'); renderBoard(); };
engine.events.on('contextlost', () => { $('board-shell').classList.remove('ready'); });
engine.events.on('contextrestored', () => { $('board-shell').classList.add('ready'); renderBoard(); });

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
  $('round-points').textContent = (settings.tracking ? progress.points : game?.score?.total || 0).toLocaleString(settings.language);
  $('round-points').title = t(settings.tracking ? 'totalPoints' : 'roundPoints');
}
function syncClock() {
  const now = performance.now();
  if (clockActive && clockGame === game && !game.completionRecorded) game.elapsedMs = Math.min(Number.MAX_SAFE_INTEGER, game.elapsedMs + Math.round(now - clockAt));
  clockAt = now; clockGame = game;
  clockActive = Boolean(game && !busy && !readOnly && !document.hidden && !game.completionRecorded && !document.querySelector('dialog[open]'));
  renderRoundStats();
}
function persist() {
  syncClock();
  if (storageBlocked || readOnly) { $('storage-status').textContent = t('unsaved'); return; }
  const ok = save(game, settings, progress);
  $('storage-status').textContent = t(ok ? 'autosave' : 'unsaved');
  if (!ok) showNotice('storageFailed');
}
function renderText() {
  document.documentElement.lang = settings.language;
  document.querySelectorAll('[data-t]').forEach(node => { node.textContent = t(node.dataset.t); });
  document.querySelectorAll('.dialog-close').forEach(node => { node.setAttribute('aria-label', t('close')); });
  $('settings-open').setAttribute('aria-label', t('settings'));
  $('achievements-nav').setAttribute('aria-label', t('achievements'));
  $('number-pad').setAttribute('aria-label', settings.language === 'de' ? 'Zahlen' : 'Numbers');
  $('language').value = settings.language; $('dark-theme').checked = settings.theme === 'dark';
  $('reduced-motion').checked = settings.reducedMotion; $('show-conflicts').checked = settings.showConflicts; $('tracking').checked = settings.tracking;
  $('sfx-enabled').checked = settings.sfxEnabled; $('sfx-volume').value = Math.round(settings.sfxVolume * 100); $('sfx-volume-value').textContent = `${$('sfx-volume').value} %`;
  document.body.dataset.theme = settings.theme; document.body.dataset.reduced = reduced();
  updateBackground();
  $('help-content').className = 'help-copy'; $('help-content').innerHTML = t('helpContent');
  $('offline-status').textContent = offline ? t('offlineReady') : t('offlinePreparing');
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
  $('new-game').disabled = busy || readOnly; $('difficulty').disabled = busy || readOnly;
  $('generation-cancel').disabled = !game;
  document.querySelectorAll('#number-pad button').forEach(button => { button.disabled = !game || busy || readOnly; button.classList.toggle('is-selected', Boolean(game && game.values[selection] === Number(button.dataset.number))); });
  if (!game) return;
  const errors = settings.showConflicts ? conflicts(game.values) : new Set();
  cells.forEach((cell, i) => {
    const notes = Array.from({ length: 9 }, (_, n) => n + 1).filter(n => game.notes[i] & (1 << n));
    cell.textContent = game.values[i] || '';
    cell.tabIndex = i === selection ? 0 : -1;
    cell.setAttribute('aria-selected', String(i === selection)); cell.setAttribute('aria-readonly', String(Boolean(game.puzzle[i] || readOnly)));
    cell.setAttribute('aria-invalid', String(errors.has(i)));
    cell.setAttribute('aria-label', `${t('cell')} ${Math.floor(i / 9) + 1}, ${t('column')} ${i % 9 + 1}, ${game.values[i] || t('empty')}${game.puzzle[i] ? ', ' + t('given') : ''}${notes.length ? ', ' + t('notes') + ' ' + notes.join(', ') : ''}${errors.has(i) ? ', ' + t('conflict') : ''}`);
  });
  const count = game.values.filter(Boolean).length;
  $('remaining').textContent = isSolved(game.values) ? t('completed') : `${81 - count} ${t('remaining')}`;
  scene.updateState(game, selection, { reduced: reduced(), dark: settings.theme === 'dark', showConflicts: settings.showConflicts, sfxEnabled:settings.sfxEnabled, sfxVolume:settings.sfxVolume });
}
function renderAchievements() {
  for (const [id,value] of [['collection-points',progress.points],['collection-best',progress.best],['collection-solved',progress.total]]) $(id).textContent = value.toLocaleString(settings.language);
  $('achievement-count').textContent = progress.unlocked.length;
  if (settings.tracking) $('treasure-caption').textContent = `${progress.unlocked.length} / ${ACHIEVEMENTS.length} ${t('achievements')}`;
  else $('treasure-caption').textContent = t('treasureCopy');
  $('progress-delete').disabled = !settings.tracking || readOnly; $('tracking').disabled = readOnly || storageBlocked;
  $('achievement-grid').replaceChildren();
  for (const a of ACHIEVEMENTS) {
    const value = Math.min(a.target, progressValue(progress, a)), unlocked = progress.unlocked.includes(a.id);
    const article = document.createElement('article'); article.className = 'achievement' + (unlocked ? ' unlocked' : '');
    const icon = document.createElement('span'); icon.className = 'achievement-icon'; icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg><use href="#i-${a.icon}"/></svg>`;
    const title = document.createElement('h3'); title.textContent = settings.language === 'de' ? a.name : a.en;
    const description = document.createElement('p'); description.textContent = t(a.id + 'Condition');
    const meter = document.createElement('progress'); meter.max = a.target; meter.value = value; meter.setAttribute('aria-label', title.textContent);
    const label = document.createElement('small'); label.textContent = !settings.tracking ? t('trackingOff') : unlocked ? t('unlocked') : `${value} / ${a.target}`;
    article.append(icon, title, description, meter, label); $('achievement-grid').append(article);
  }
}
function input(number) {
  if (!game || busy || readOnly) return;
  syncClock();
  const before = fullUnits(game);
  if (!enter(game, selection, number, noteMode && number !== 0)) return;
  const solved = isSolved(game.values), firstWin = solved && !game.completionRecorded;
  const fresh = firstWin ? complete(game, progress, settings.tracking) : [];
  persist(); renderBoard(); renderAchievements(); scene.pop(selection);
  if (firstWin) {
    $('win-points').textContent = game.score.total.toLocaleString(settings.language);
    $('score-breakdown').replaceChildren();
    for (const [key,label] of [['base','scoreBase'],['time','scoreTime'],['clean','scoreClean'],['direct','scoreDirect'],['milestone','scoreMilestone']]) {
      const name = document.createElement('dt'), value = document.createElement('dd');
      name.textContent = t(label); value.textContent = `+${game.score[key].toLocaleString(settings.language)}`;
      $('score-breakdown').append(name,value);
    }
    $('new-achievements').replaceChildren();
    for (const a of fresh) { const item = document.createElement('div'); item.className = 'new-badge'; item.textContent = `${t('newAchievement')}: ${settings.language === 'de' ? a.name : a.en}`; $('new-achievements').append(item); }
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
async function newPuzzle(difficulty = $('difficulty').value, ask = true) {
  if (readOnly || busy) return;
  if (ask && game && !isSolved(game.values)) {
    if (!await confirmation('replaceTitle', 'replaceCopy')) { $('difficulty').value = game.difficulty; return; }
  }
  const hadGame = Boolean(game), token = ++generation; busy = true; renderBoard(); $('loading').hidden = false;
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
  busy = false; $('loading').hidden = true;
  if (result && validGame(createGame(result))) {
    game = createGame(result); selection = Math.max(0, game.values.findIndex(v => !v)); noteMode = false;
    $('difficulty').value = difficulty; persist(); announce(t('gameTitle'));
  } else { showNotice('generationFailed'); if (game) $('difficulty').value = game.difficulty; }
  renderBoard();
  if (result && hadGame) scene.playSfx('new');
}
$('generation-cancel').addEventListener('click', () => {
  generation++; workerJob?.finish(null); busy = false; $('loading').hidden = true; if (game) $('difficulty').value = game.difficulty; renderBoard();
});
$('new-game').addEventListener('click', () => newPuzzle());
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
  if (document.querySelector('dialog[open]') || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-9]$/.test(event.key)) { event.preventDefault(); input(Number(event.key)); }
  else if (['Delete','Backspace'].includes(event.key)) { event.preventDefault(); input(0); }
  else if (event.key.toLowerCase() === 'n' && !readOnly && !busy) { noteMode = !noteMode; renderBoard(); }
});
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
for (const id of ['achievements-nav','treasure-open']) $(id).addEventListener('click', () => { renderAchievements(); $('achievements-dialog').showModal(); });
$('settings-open').addEventListener('click', () => $('settings-dialog').showModal());
$('help-open').addEventListener('click', () => $('help-dialog').showModal());
$('play-nav').addEventListener('click', () => { cells[selection].focus(); });
function changeSettings() {
  if (readOnly) { renderText(); return; }
  settings.language = $('language').value; settings.theme = $('dark-theme').checked ? 'dark' : 'light';
  settings.reducedMotion = $('reduced-motion').checked; settings.showConflicts = $('show-conflicts').checked;
  renderText(); persist();
}
for (const id of ['language','dark-theme','reduced-motion','show-conflicts']) $(id).addEventListener('change', changeSettings);
$('sfx-enabled').addEventListener('change', () => { settings.sfxEnabled = $('sfx-enabled').checked; renderBoard(); persist(); });
$('sfx-volume').addEventListener('input', () => { settings.sfxVolume = Number($('sfx-volume').value) / 100; $('sfx-volume-value').textContent = `${$('sfx-volume').value} %`; renderBoard(); persist(); });
$('test-sound').addEventListener('click', () => scene.playSfx('achievement'));
document.addEventListener('click', event => { if (event.target.closest('button') && !event.target.closest('.cell, #number-pad, #undo, #erase, #test-sound, #new-game, #win-next')) scene.playSfx('menu'); });
$('tracking').addEventListener('change', async () => {
  if (readOnly || storageBlocked) return;
  if (!$('tracking').checked && progress.total > 0 && !await confirmation('stopTrackingTitle', 'stopTrackingCopy')) { $('tracking').checked = true; return; }
  settings.tracking = $('tracking').checked;
  if (!settings.tracking) progress = emptyProgress();
  persist(); renderBoard(); renderAchievements();
});
$('progress-delete').addEventListener('click', async () => {
  if (!readOnly && await confirmation('deleteTitle', 'deleteCopy')) { progress = emptyProgress(); persist(); renderBoard(); renderAchievements(); }
});
$('storage-reset').addEventListener('click', async () => {
  if (!readOnly && await confirmation('resetTitle', 'resetCopy')) { storageBlocked = false; $('notice').hidden = true; $('storage-reset').hidden = true; persist(); renderAchievements(); }
});
media.addEventListener('change', () => { document.body.dataset.reduced = reduced(); updateBackground(); renderBoard(); });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  if (readOnly) { const fresh = load(); if (fresh.game) { game = fresh.game; progress = fresh.progress; renderBoard(); renderAchievements(); } }
});
window.addEventListener('pagehide', () => { syncClock(); persist(); workerJob?.worker.terminate(); });
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
  if (!('serviceWorker' in navigator)) { $('offline-status').textContent = ''; return; }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    const offer = () => { if (registration.waiting && navigator.serviceWorker.controller) { waitingRegistration = registration; $('update').hidden = false; } };
    offer(); registration.addEventListener('updatefound', () => { registration.installing?.addEventListener('statechange', offer); });
    await navigator.serviceWorker.ready; offline = true; $('offline-status').textContent = t('offlineReady');
  } catch { $('offline-status').textContent = ''; }
}
$('update').addEventListener('click', () => {
  if (busy || readOnly || storageBlocked || !save(game, settings, progress)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waitingRegistration?.waiting?.postMessage('ACTIVATE');
});
renderText();
await acquireWriter();
renderBoard();
if (game) { $('loading').hidden = true; persist(); }
else if (!readOnly) newPuzzle('easy', false);
else $('loading').hidden = true;
offlineSetup();
