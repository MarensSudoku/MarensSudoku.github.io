import Phaser from '../vendor/phaser.esm.min.js';
import { PEERS, UNITS, conflicts } from '../sudoku/engine.mjs';
const SOUND_FILES = { entry:'01-zahl-eintragen.wav', note:'02-notiz-setzen.wav', erase:'03-zahl-loeschen.wav', unit:'04-einheit-geschafft.wav', achievement:'05-neue-perle.wav', win:'06-riffsieg.wav', menu:'07-menue-antippen.wav', new:'08-neuer-tauchgang.wav' };

export class BoardScene extends Phaser.Scene {
  constructor() { super('board'); this.selection = 0; this.gameState = null; this.reduced = false; this.dark = false; this.effects = new Set(); }
  preload() {
    this.load.image('bubble', new URL('../assets/bubble.svg', import.meta.url).href);
    this.nativeAudioFallback = !(window.AudioContext || window.webkitAudioContext);
    if (!this.nativeAudioFallback) for (const [key, file] of Object.entries(SOUND_FILES)) this.load.audio('reef-' + key, new URL('../assets/sounds/' + file, import.meta.url).href);
  }
  create() {
    this.cues = Object.fromEntries(Object.keys(SOUND_FILES).filter(key => this.cache.audio.exists('reef-' + key)).map(key => [key, this.sound.add('reef-' + key)]));
    this.nativeCues = this.nativeAudioFallback ? Object.fromEntries(Object.entries(SOUND_FILES).map(([key, file]) => { const audio = new Audio(); audio.preload = 'none'; audio.src = new URL('../assets/sounds/' + file, import.meta.url).href; return [key, audio]; })) : {};
    this.paint = this.add.graphics();
    this.labels = Array.from({ length: 81 }, (_, i) => this.add.text((i % 9) * 60 + 30, Math.floor(i / 9) * 60 + 30, '', {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '31px', color: '#164557', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.noteLabels = Array.from({ length: 81 }, (_, i) => Array.from({ length: 9 }, (_, n) => this.add.text(
      (i % 9) * 60 + (n % 3) * 17 + 13, Math.floor(i / 9) * 60 + Math.floor(n / 3) * 17 + 13, '', {
        fontFamily: 'Segoe UI, sans-serif', fontSize: '15px', color: '#527782',
      }).setOrigin(0.5)));
    this.ready = true;
    this.draw();
    this.onReady?.();
  }
  updateState(game, selection, { reduced, dark, showConflicts, sfxEnabled, sfxVolume }) {
    if (reduced && !this.reduced) this.stopEffects();
    this.gameState = game; this.selection = selection; this.reduced = reduced; this.dark = dark; this.showConflicts = showConflicts;
    this.sfxEnabled = sfxEnabled; this.sfxVolume = sfxVolume;
    if (!sfxEnabled && this.cues) Object.values(this.cues).forEach(cue => cue.stop());
    if (!sfxEnabled && this.nativeCues) Object.values(this.nativeCues).forEach(cue => cue.pause());
    if (this.ready) this.draw();
  }
  draw() {
    if (!this.gameState) return;
    const state = this.gameState, selected = this.selection, errors = this.showConflicts ? conflicts(state.values) : new Set();
    const color = this.dark ? { base: 0x143d4c, peer: 0x1b4b59, same: 0x275d69, selected: 0x387986, line: 0x527c88, text: '#eafcfc', own: '#85e0e5', error: 0x744250 } :
      { base: 0xffffff, peer: 0xeff9fa, same: 0xdff3f3, selected: 0xb8e8e8, line: 0x82b0b9, text: '#164557', own: '#087c91', error: 0xffdfe0 };
    this.paint.clear();
    for (let i = 0; i < 81; i++) {
      const related = PEERS[selected]?.includes(i), matching = state.values[selected] && state.values[i] === state.values[selected];
      this.paint.fillStyle(errors.has(i) ? color.error : i === selected ? color.selected : matching ? color.same : related ? color.peer : color.base);
      this.paint.fillRect((i % 9) * 60, Math.floor(i / 9) * 60, 60, 60);
      this.labels[i].setText(state.values[i] || '').setColor(state.puzzle[i] ? color.text : color.own).setFontStyle(state.puzzle[i] ? 'bold' : 'normal');
      for (let n = 0; n < 9; n++) this.noteLabels[i][n].setText(!state.values[i] && state.notes[i] & (1 << (n + 1)) ? String(n + 1) : '').setColor(this.dark ? '#a3c6cd' : '#527782');
    }
    for (let i = 0; i <= 9; i++) {
      this.paint.lineStyle(i % 3 === 0 ? 2.5 : 0.6, color.line, i % 3 === 0 ? 1 : 0.48);
      this.paint.lineBetween(i * 60, 0, i * 60, 540); this.paint.lineBetween(0, i * 60, 540, i * 60);
    }
  }
  pop(index) {
    if (!this.ready || this.reduced) return;
    const text = this.labels[index];
    this.tweens.killTweensOf(text); text.setScale(0.78);
    this.tweens.add({ targets: text, scale: 1, duration: 180, ease: 'Back.Out' });
  }
  playSfx(key) {
    if (!this.ready || !this.sfxEnabled) return;
    if (this.nativeAudioFallback) {
      const cue = this.nativeCues[key]; if (!cue) return;
      if (key === 'win') Object.values(this.nativeCues).forEach(sound => sound.pause());
      cue.pause(); if (cue.readyState) cue.currentTime = 0; cue.volume = this.sfxVolume;
      cue.play().catch(() => {}); return;
    }
    if (this.sound.locked || !this.cues[key]) return;
    if (key === 'win') Object.values(this.cues).forEach(cue => cue.stop());
    const cue = this.cues[key]; cue.stop(); cue.play({ volume:this.sfxVolume });
  }
  shimmer(units) {
    if (!this.ready || this.reduced || !units.length) return;
    for (const i of [...new Set(units.flatMap(n => UNITS[n]))]) {
      const glow = this.add.rectangle(i % 9 * 60 + 30, Math.floor(i / 9) * 60 + 30, 56, 56, 0x9ce4dd, 0.4).setDepth(4);
      this.effects.add(glow);
      this.tweens.add({ targets: glow, alpha: 0, duration: 380, delay: i % 9 * 22, onComplete: () => { this.effects.delete(glow); glow.destroy(); } });
    }
  }
  celebrate() {
    if (!this.ready || this.reduced) return;
    this.shimmer(Array.from({ length: 27 }, (_, i) => i));
    const emitter = this.add.particles(270, 400, 'bubble', {
      lifespan: 1700, speedY: { min: -260, max: -100 }, speedX: { min: -180, max: 180 },
      scale: { start: 0.6, end: 0.1 }, alpha: { start: 0.8, end: 0 }, emitting: false,
    }).setDepth(5);
    this.effects.add(emitter);
    emitter.explode(28);
    this.time.delayedCall(1800, () => { if (this.effects.delete(emitter)) emitter.destroy(); });
  }
  stopEffects() {
    if (!this.ready) return;
    for (const effect of this.effects) { this.tweens.killTweensOf(effect); effect.destroy(); }
    this.effects.clear();
    for (const label of this.labels) { this.tweens.killTweensOf(label); label.setScale(1); }
  }
}
export function createBoard(parent) {
  const scene = new BoardScene();
  const engine = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 540, height: 540, transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, pixelArt: false }, scene: [scene],
    fps: { target: 30, forceSetTimeOut: true }, banner: false,
    callbacks: { postBoot: game => game.canvas.setAttribute('aria-hidden', 'true') },
  });
  return { scene, engine };
}
