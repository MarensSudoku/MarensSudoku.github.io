export const DEFAULT_MUSIC_TRACK = '03-zwischen-bunten-korallen.mp3';
export function makeMusicTracks(files) {
  return files.filter(file => typeof file === 'string' && !/[\\/]/.test(file) && /\.(mp3|ogg|wav|m4a)$/i.test(file)).sort((a,b)=>a.localeCompare(b)).map(file => {
    const base = file.replace(/\.[^.]+$/, ''), fallback = base.replace(/^\d+[-_ ]*/, '').replaceAll('-', ' ').replaceAll('_', ' ');
    return { file, key: 'track.' + base, fallback };
  });
}
// Titles come from the language files; unknown dropped-in files keep a readable file name.
export function trackName(track, t) {
  const name = t(track.key) === track.key ? track.fallback : t(track.key);
  const number=/^\d+(?=-)/.exec(track.file)?.[0];
  return number ? `${number} · ${name}` : name;
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
  const favorites = document.getElementById('music-favorites-only');
  const playlist = document.getElementById('music-playlist');
  let revision = 0, failed = false, awaitingGesture = false, tracks = [], resumePosition = null;
  const history = [];
  audio.volume = settings.musicVolume;
  const playableTracks=()=>settings.musicFavoritesOnly?tracks.filter(track=>settings.musicFavorites.includes(track.file)):tracks;

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
    const playable=playableTracks();
    select.replaceChildren(...playable.map(track => {
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
    favorites.title=t('musicFavoritesOnly');favorites.setAttribute('aria-label',favorites.title);
    favorites.setAttribute('aria-pressed',String(settings.musicFavoritesOnly));
    for(let index=0;index<tracks.length;index++){
      const track=tracks[index],row=playlist.children[index],favorite=settings.musicFavorites.includes(track.file),title=trackName(track,t);
      row.firstElementChild.textContent=title;
      row.firstElementChild.setAttribute('aria-current',String(track.file===settings.musicTrack));
      row.firstElementChild.disabled=settings.musicFavoritesOnly&&!favorite;
      row.lastElementChild.setAttribute('aria-pressed',String(favorite));
      row.lastElementChild.title=t('musicFavorite').replace('{title}',title);
      row.lastElementChild.setAttribute('aria-label',row.lastElementChild.title);
    }
    document.getElementById('music-mute-icon').setAttribute('href', audio.muted ? '#i-mute' : '#i-volume');
    for (const node of [button, previous, next, shuffle, mute, select, volume]) node.disabled = !playable.length;
    favorites.disabled=!tracks.length;
    document.getElementById('music-state').textContent = t(playing ? 'musicPlaying' : 'musicPaused');
    document.getElementById('music-status').textContent = failed ? t('musicError') : settings.musicFavoritesOnly&&!playable.length ? t('musicFavoritesEmpty') : awaitingGesture ? t('musicAwaiting') : '';
    renderTime();
  }
  function pause() { revision++; audio.pause(); render(); }
  function clearMediaSession() {
    if(navigator.mediaSession){navigator.mediaSession.playbackState='none';navigator.mediaSession.metadata=null;}
  }
  function stop() {
    if(audio.hasAttribute('src'))resumePosition={src:audio.src,time:audio.currentTime};
    pause();audio.removeAttribute('src');audio.load();
    clearMediaSession();
  }
  function changeTrack(file, remember = true) {
    if (remember) history.push(settings.musicTrack);
    pause(); settings.musicTrack = file; failed = false; persist(); render();
    if (settings.musicEnabled) play();
  }
  function nextTrack() { const file=pickMusicTrack(playableTracks(),settings.musicTrack,settings.musicOrder);if(file)changeTrack(file); }
  function previousTrack() {
    const playable=playableTracks();if(!playable.length)return;
    // Like common players: after a few seconds, "previous" restarts the current track first.
    if (audio.currentTime > 3 || (!history.length && settings.musicOrder === 'shuffle')) { audio.currentTime = 0; renderTime(); return; }
    const index = playable.findIndex(track => track.file === settings.musicTrack);
    let file;do{file=history.pop();}while(file&&!playable.some(track=>track.file===file));
    changeTrack(file ?? playable.at(index-1)?.file ?? playable[0].file, false);
  }
  async function play() {
    if (document.hidden || !settings.musicEnabled) return;
    const current = ++revision; failed = false;
    if (!playableTracks().some(track => track.file === settings.musicTrack)) return;
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
  function updateFavorites(){
    const playable=playableTracks();history.length=0;
    if(!playable.length)stop();
    else if(!playable.some(track=>track.file===settings.musicTrack))changeTrack(pickMusicTrack(playable,settings.musicTrack,settings.musicOrder),false);
    else if(settings.musicEnabled&&audio.paused)play();
    persist();render();
  }
  favorites.addEventListener('click',()=>{settings.musicFavoritesOnly=!settings.musicFavoritesOnly;updateFavorites();});
  playlist.addEventListener('click',event=>{
    const favorite=event.target.closest('[data-favorite]');
    if(favorite){
      const file=favorite.dataset.favorite;
      settings.musicFavorites=settings.musicFavorites.includes(file)?settings.musicFavorites.filter(item=>item!==file):[...settings.musicFavorites,file];
      updateFavorites();
    }else{
      const file=event.target.closest('[data-music-play]')?.dataset.musicPlay;
      if(file&&playableTracks().some(track=>track.file===file))changeTrack(file);
    }
  });
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
  audio.addEventListener('pause', () => {render();if(document.hidden||!audio.hasAttribute('src'))clearMediaSession();});
  // Media unloading completes asynchronously; clear any late browser playback bookkeeping too.
  audio.addEventListener('emptied',()=>{if(!audio.hasAttribute('src'))clearMediaSession();});
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
    settings.musicFavorites=settings.musicFavorites.filter(file=>tracks.some(track=>track.file===file));
    playlist.replaceChildren(...tracks.map(track=>{
      const row=document.createElement('li'),play=document.createElement('button'),heart=document.createElement('button');
      play.type=heart.type='button';play.dataset.musicPlay=heart.dataset.favorite=track.file;
      play.className='music-play-track';heart.className='icon-button music-favorite';
      heart.innerHTML='<svg aria-hidden="true"><use href="#i-heart"/></svg>';
      row.append(play,heart);return row;
    }));
    if(playableTracks().length)nextTrack();else{stop();persist();render();}
  }).catch(() => { failed = true; render(); });
  render();
  return { render };
}
