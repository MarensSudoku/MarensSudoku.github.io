import { UNITS } from '../sudoku/engine.mjs';
const SOUND_FILES = { entry:'01-zahl-eintragen.wav', note:'02-notiz-setzen.wav', erase:'03-zahl-loeschen.wav', unit:'04-einheit-geschafft.wav', achievement:'05-neue-perle.wav', win:'06-riffsieg.wav', menu:'07-menue-antippen.wav', new:'08-neuer-tauchgang.wav' };

export function createEffects(parent) {
  const layer = document.getElementById(parent), effects = new Set(), sounds = new Set(), buffers = {};
  let context;
  try { const AudioContext = window.AudioContext || window.webkitAudioContext; if (AudioContext) context = new AudioContext(); } catch {}
  const native = context ? {} : Object.fromEntries(Object.entries(SOUND_FILES).map(([key, file]) => {
    const audio = new Audio(); audio.preload = 'none'; audio.src = new URL('../assets/sounds/' + file, import.meta.url).href; return [key, audio];
  }));
  if (context) {
    for (const [key, file] of Object.entries(SOUND_FILES)) {
      fetch(new URL('../assets/sounds/' + file, import.meta.url)).then(response => {
        if (!response.ok) throw new Error('Sound unavailable'); return response.arrayBuffer();
      }).then(data => context.decodeAudioData(data)).then(buffer => { buffers[key] = buffer; }).catch(() => {});
    }
    const unlock = () => { if (context.state === 'suspended') context.resume().catch(() => {}); };
    for (const event of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(event, unlock, { passive:true });
  }
  function stopSounds() {
    for (const sound of sounds) { try { sound.stop(); } catch {} }
    sounds.clear(); Object.values(native).forEach(sound => sound.pause());
  }
  function animate(element, frames, options) {
    layer.append(element);
    const animation = element.animate(frames, options); effects.add(animation);
    animation.finished.catch(() => {}).finally(() => { effects.delete(animation); element.remove(); });
  }
  const scene = {
    ready:true, reduced:false, sfxEnabled:true, sfxVolume:0.5,
    updateOptions({ reduced, sfxEnabled, sfxVolume }) {
      if (reduced && !this.reduced) this.stopEffects();
      this.reduced = reduced; this.sfxEnabled = sfxEnabled; this.sfxVolume = sfxVolume;
      if (!sfxEnabled) stopSounds();
    },
    playSfx(key) {
      if (!this.sfxEnabled) return;
      if (key === 'win') stopSounds();
      if (!context) {
        const cue = native[key]; if (!cue) return;
        cue.pause(); if (cue.readyState) cue.currentTime = 0; cue.volume = this.sfxVolume; cue.play().catch(() => {}); return;
      }
      if (!buffers[key] || context.state !== 'running') return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers[key]; gain.gain.value = this.sfxVolume;
      source.connect(gain); gain.connect(context.destination); sounds.add(source);
      source.onended = () => { sounds.delete(source); source.disconnect(); gain.disconnect(); }; source.start();
    },
    shimmer(units) {
      if (this.reduced) return;
      for (const i of new Set(units.flatMap(n => UNITS[n]))) {
        const glow = document.createElement('span'); glow.className = 'unit-glow';
        glow.style.left = `${i % 9 * 100 / 9}%`; glow.style.top = `${Math.floor(i / 9) * 100 / 9}%`;
        animate(glow, [{ opacity:0.65 }, { opacity:0 }], { duration:380, delay:i % 9 * 22, fill:'both' });
      }
    },
    celebrate() {
      if (this.reduced) return;
      this.shimmer(Array.from({ length:27 }, (_, i) => i));
      for (let i = 0; i < 28; i++) {
        const bubble = document.createElement('span'); bubble.className = 'victory-bubble';
        bubble.style.left = `${15 + Math.random() * 70}%`; bubble.style.top = `${60 + Math.random() * 35}%`;
        animate(bubble, [{ opacity:0.8, transform:'translate(0,0) scale(1)' }, { opacity:0, transform:`translate(${(Math.random() - 0.5) * 160}px,-250px) scale(.2)` }], { duration:1400 + Math.random() * 400, easing:'ease-out' });
      }
    },
    stopEffects() { for (const effect of effects) effect.cancel(); effects.clear(); layer.replaceChildren(); },
  };
  queueMicrotask(() => scene.onReady?.());
  return scene;
}
