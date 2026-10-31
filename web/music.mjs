export const DEFAULT_MUSIC_TRACK = '02-zwischen-bunten-korallen_1.mp3';
export function makeMusicTracks(files) {
  return files.filter(file => typeof file === 'string' && !/[\\/]/.test(file) && /\.(mp3|ogg|wav|m4a)$/i.test(file)).sort((a, b) => a === b ? 0 : a === DEFAULT_MUSIC_TRACK ? -1 : b === DEFAULT_MUSIC_TRACK ? 1 : a.localeCompare(b)).map(file => {
    const stem = file.replace(/\.[^.]+$/, ''), suffix = /(?:_\d+)+$/.exec(stem);
    const variant = suffix ? suffix[0].split('_').at(-1) : '';
    const base = stem.replace(/(?:_\d+)+$/, ''), fallback = base.replace(/^\d+[-_ ]*/, '').replaceAll('-', ' ').replaceAll('_', ' ');
    return { file, key: 'track.' + base, fallback, variant };
  });
}
// Titles come from the language files; unknown dropped-in files keep a readable file name.
export function trackName(track, t) {
  const name = t(track.key) === track.key ? track.fallback : t(track.key);
  return track.variant ? `${name} · ${t('musicVariant').replace('{n}', track.variant)}` : name;
}
export function pickMusicTrack(tracks, current, order = 'shuffle') {
  if (order === 'sequential') return tracks[(tracks.findIndex(track => track.file === current) + 1) % tracks.length]?.file || '';
  const choices = tracks.length > 1 ? tracks.filter(track => track.file !== current) : tracks;
  return choices[Math.floor(Math.random() * choices.length)]?.file || '';
}

export function setupMusic(settings, t, persist) {
  const audio = document.getElementById('reef-music');
  const select = document.getElementById('music-track');
  const volume = document.getElementById('music-volume');
  const button = document.getElementById('music-toggle');
  const seek = document.getElementById('music-seek');
  const previous = document.getElementById('music-previous');
  const next = document.getElementById('music-next');
  const shuffle = document.getElementById('music-shuffle');
  const mute = document.getElementById('music-mute');
  let revision = 0, failed = false, awaitingGesture = false, tracks = [], resumePosition = null;
  const history = [];
  audio.volume = settings.musicVolume;

  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  function renderTime() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    seek.max = duration; seek.value = audio.currentTime; seek.disabled = !duration;
    seek.style.setProperty('--p', `${duration ? audio.currentTime / duration * 100 : 0}%`);
    document.getElementById('music-elapsed').textContent = clock(audio.currentTime);
    document.getElementById('music-duration').textContent = clock(duration);
    seek.setAttribute('aria-valuetext', `${clock(audio.currentTime)} / ${clock(duration)}`);
  }
  function render() {
    select.replaceChildren(...tracks.map(track => {
      const option = document.createElement('option'); option.value = track.file; option.textContent = trackName(track, t); return option;
    }));
    select.value = settings.musicTrack;
    volume.value = Math.round(settings.musicVolume * 100); volume.style.setProperty('--p', `${volume.value}%`);
    document.getElementById('music-volume-value').textContent = `${volume.value} %`;
    const playing = !audio.paused;
    document.getElementById('music-player').classList.toggle('is-playing', playing);
    document.getElementById('music-toggle-icon').setAttribute('href', playing ? '#i-pause' : '#i-play');
    button.title = t(playing ? 'musicPause' : 'musicStart'); previous.title = t('musicPrevious'); next.title = t('musicNext');
    shuffle.title = t('musicShuffle'); mute.title = t('musicMute');
    for (const node of [button, previous, next, shuffle, mute]) node.setAttribute('aria-label', node.title);
    seek.setAttribute('aria-label', t('musicSeek'));
    shuffle.setAttribute('aria-pressed', String(settings.musicOrder === 'shuffle'));
    mute.setAttribute('aria-pressed', String(audio.muted));
    document.getElementById('music-mute-icon').setAttribute('href', audio.muted ? '#i-mute' : '#i-volume');
    for (const node of [button, previous, next, shuffle, mute, select, volume]) node.disabled = !tracks.length;
    document.getElementById('music-state').textContent = t(playing ? 'musicPlaying' : 'musicPaused');
    document.getElementById('music-status').textContent = failed ? t('musicError') : awaitingGesture ? t('musicAwaiting') : '';
    renderTime();
  }
  function pause() { revision++; audio.pause(); render(); }
  function stop() {
    if(audio.hasAttribute('src'))resumePosition={src:audio.src,time:audio.currentTime};
    pause();audio.removeAttribute('src');audio.load();
    if(navigator.mediaSession){navigator.mediaSession.playbackState='none';navigator.mediaSession.metadata=null;}
  }
  function changeTrack(file, remember = true) {
    if (remember) history.push(settings.musicTrack);
    pause(); settings.musicTrack = file; failed = false; persist(); render();
    if (settings.musicEnabled) play();
  }
  function nextTrack() { changeTrack(pickMusicTrack(tracks, settings.musicTrack, settings.musicOrder)); }
  function previousTrack() {
    // Like common players: after a few seconds, "previous" restarts the current track first.
    if (audio.currentTime > 3 || (!history.length && settings.musicOrder === 'shuffle')) { audio.currentTime = 0; renderTime(); return; }
    const index = tracks.findIndex(track => track.file === settings.musicTrack);
    changeTrack(history.pop() ?? tracks.at(index - 1).file, false);
  }
  async function play() {
    if (document.hidden || !settings.musicEnabled) return;
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
  button.addEventListener('click', () => {
    settings.musicEnabled = audio.paused;
    awaitingGesture = false; persist();
    if (settings.musicEnabled) play(); else pause();
  });
  select.addEventListener('change', () => changeTrack(select.value));
  next.addEventListener('click', nextTrack);
  previous.addEventListener('click', previousTrack);
  shuffle.addEventListener('click', () => { settings.musicOrder = settings.musicOrder === 'shuffle' ? 'sequential' : 'shuffle'; persist(); render(); });
  // ponytail: mute lasts for this visit only; the saved volume stays the lasting setting.
  mute.addEventListener('click', () => { audio.muted = !audio.muted; render(); });
  seek.addEventListener('input', () => { audio.currentTime = Number(seek.value); renderTime(); });
  for (const type of ['timeupdate', 'durationchange', 'emptied']) audio.addEventListener(type, renderTime);
  volume.addEventListener('input', () => {
    settings.musicVolume = Number(volume.value) / 100;
    audio.volume = settings.musicVolume; persist(); render();
  });
  audio.addEventListener('loadedmetadata',()=>{
    if(resumePosition?.src===audio.src)audio.currentTime=resumePosition.time;
    resumePosition=null;
  });
  audio.addEventListener('playing', () => { awaitingGesture = false; failed = false; render(); });
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => { if (settings.musicEnabled) nextTrack(); });
  audio.addEventListener('error', () => { revision++; failed = true; audio.pause(); render(); });
  function userGesture(event) {
    if (event.isTrusted && !event.target.closest('#music-toggle') && settings.musicEnabled && audio.paused && tracks.length && !failed) play();
  }
  document.addEventListener('pointerdown', userGesture, { capture:true, passive:true });
  document.addEventListener('click', userGesture, true);
  document.addEventListener('keydown', userGesture, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (settings.musicEnabled && !failed) play();
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow',()=>{if(settings.musicEnabled&&!failed)play();});
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
