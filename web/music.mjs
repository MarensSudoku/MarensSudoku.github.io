const TITLES = {
  '01-sonnenlicht-ueber-dem-riff': ['Sonnenlicht über dem Riff', 'Sunlight over the reef'],
  '02-zwischen-bunten-korallen': ['Zwischen bunten Korallen', 'Among colourful corals'],
  '03-schwebende-perlen': ['Schwebende Perlen', 'Floating pearls'],
  '04-kristallklares-wasser': ['Kristallklares Wasser', 'Crystal-clear water'],
  '05-abend-im-riff': ['Abend im Riff', 'Evening at the reef'],
  '06-stille-lagune': ['Stille Lagune', 'Quiet lagoon'],
};
export const DEFAULT_MUSIC_TRACK = '02-zwischen-bunten-korallen_1.mp3';
export function makeMusicTracks(files) {
  return files.filter(file => typeof file === 'string' && !/[\\/]/.test(file) && /\.(mp3|ogg|wav|m4a)$/i.test(file)).sort((a, b) => a === b ? 0 : a === DEFAULT_MUSIC_TRACK ? -1 : b === DEFAULT_MUSIC_TRACK ? 1 : a.localeCompare(b)).map(file => {
    const stem = file.replace(/\.[^.]+$/, ''), suffix = /(?:_\d+)+$/.exec(stem);
    const variant = suffix ? suffix[0].split('_').at(-1) : '';
    const base = stem.replace(/(?:_\d+)+$/, ''), fallback = base.replace(/^\d+[-_ ]*/, '').replaceAll('-', ' ').replaceAll('_', ' ');
    const names = TITLES[base] || [fallback, fallback];
    return { file, de: names[0] + (variant ? ` · Variante ${variant}` : ''), en: names[1] + (variant ? ` · Version ${variant}` : '') };
  });
}
export function pickMusicTrack(tracks, current) {
  const choices = tracks.length > 1 ? tracks.filter(track => track.file !== current) : tracks;
  return choices[Math.floor(Math.random() * choices.length)]?.file || '';
}

export function setupMusic(settings, t, persist) {
  const audio = document.getElementById('reef-music');
  const select = document.getElementById('music-track');
  const volume = document.getElementById('music-volume');
  const buttons = [document.getElementById('music-toggle'), document.getElementById('music-toggle-footer')];
  let revision = 0, failed = false, awaitingGesture = false, tracks = [];
  audio.volume = settings.musicVolume;

  function render() {
    select.replaceChildren(...tracks.map(track => {
      const option = document.createElement('option'); option.value = track.file; option.textContent = track[settings.language]; return option;
    }));
    select.value = settings.musicTrack;
    volume.value = Math.round(settings.musicVolume * 100);
    document.getElementById('music-volume-value').textContent = `${volume.value} %`;
    for (const button of buttons) {
      button.disabled = !tracks.length;
      button.textContent = t(audio.paused ? 'musicStart' : 'musicPause');
      button.setAttribute('aria-pressed', String(!audio.paused));
    }
    select.disabled = !tracks.length; volume.disabled = !tracks.length;
    document.getElementById('music-status').textContent = failed ? t('musicError') : awaitingGesture ? t('musicAwaiting') : !audio.paused ? `${t('musicPlaying')}: ${tracks.find(track => track.file === settings.musicTrack)?.[settings.language] || ''}` : t('musicHelp');
  }
  function pause() { revision++; audio.pause(); render(); }
  function nextTrack() {
    pause(); settings.musicTrack = pickMusicTrack(tracks, settings.musicTrack); persist();
    if (settings.musicEnabled) play(); else render();
  }
  async function play() {
    const current = ++revision; failed = false;
    if (!tracks.some(track => track.file === settings.musicTrack)) return;
    const url = new URL('./assets/music/' + encodeURIComponent(settings.musicTrack), import.meta.url).href;
    if (audio.src !== url || audio.error) audio.src = url;
    try { await audio.play(); }
    catch (error) {
      if (revision === current) {
        awaitingGesture = error.name === 'NotAllowedError'; failed = !awaitingGesture;
        audio.pause();
      }
    }
    if (revision === current) render();
  }
  for (const button of buttons) button.addEventListener('click', () => {
    settings.musicEnabled = audio.paused;
    awaitingGesture = false; persist();
    if (settings.musicEnabled) play(); else pause();
  });
  select.addEventListener('change', () => {
    const resume = settings.musicEnabled, selected = select.value;
    pause(); settings.musicTrack = selected; failed = false; persist(); render();
    if (resume) play();
  });
  volume.addEventListener('input', () => {
    settings.musicVolume = Number(volume.value) / 100;
    audio.volume = settings.musicVolume; persist(); render();
  });
  audio.addEventListener('playing', () => { awaitingGesture = false; failed = false; render(); });
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => { if (settings.musicEnabled) nextTrack(); });
  audio.addEventListener('error', () => { revision++; failed = true; audio.pause(); render(); });
  function userGesture(event) {
    if (event.isTrusted && !event.target.closest('#music-toggle, #music-toggle-footer') && settings.musicEnabled && audio.paused && tracks.length && !failed) play();
  }
  document.addEventListener('pointerdown', userGesture, { capture:true, passive:true });
  document.addEventListener('click', userGesture, true);
  document.addEventListener('keydown', userGesture, true);
  window.addEventListener('pagehide', pause);
  fetch(new URL('./assets/music/tracks.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('Music catalogue unavailable');
    const files = await response.json();
    if (!Array.isArray(files)) throw new Error('Invalid music catalogue');
    tracks = makeMusicTracks(files);
    nextTrack();
  }).catch(() => { failed = true; render(); });
  render();
  return { render };
}
