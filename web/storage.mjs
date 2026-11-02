import { emptyProgress, emptyScores, validGame, ACHIEVEMENTS } from './sudoku/model.mjs';
import { DEFAULT_MUSIC_TRACK } from './music.mjs';
import { LOCALES, resolveLanguage } from './locales.mjs';
export const STORAGE_KEY = 'marenssudoku:state:v1';
const renamedMusic={
  '01-sonnenlicht-ueber-dem-riff_1.mp3':'01-sonnenlicht-ueber-dem-riff.mp3',
  '01-sonnenlicht-ueber-dem-riff_2.mp3':'02-goldene-strahlen.mp3',
  '02-zwischen-bunten-korallen_1.mp3':'03-zwischen-bunten-korallen.mp3',
  '02-zwischen-bunten-korallen_2.mp3':'04-tanz-der-rifffische.mp3',
  '03-schwebende-perlen_1.mp3':'05-schwebende-perlen.mp3',
  '04-kristallklares-wasser_1.mp3':'06-kristallklares-wasser.mp3',
  '04-kristallklares-wasser_1_2.mp3':'07-tuerkise-weite.mp3',
  '05-abend-im-riff_1.mp3':'08-abend-im-riff.mp3',
  '05-abend-im-riff_1_2.mp3':'09-korallen-im-abendlicht.mp3',
  '06-stille-lagune_1.mp3':'10-stille-lagune.mp3',
  '06-stille-lagune_2.mp3':'11-schweben-im-blau.mp3',
};
export const defaults = () => ({ language: resolveLanguage(navigator.languages || [navigator.language]), theme: 'light', reducedMotion: false, energySaver:false, showConflicts: true, tracking: true, musicVolume: 0.25, musicTrack: DEFAULT_MUSIC_TRACK, musicOrder:'shuffle', musicEnabled: true, musicMuted:false, rememberMusic:false, musicFavorites:[], musicFavoritesOnly:false, sfxEnabled: true, sfxVolume: 0.3 });
function validProgress(p) {
  return p && ['total','easy','medium','hard','direct'].every(k => Number.isSafeInteger(p[k]) && p[k] >= 0) &&
    p.total === p.easy + p.medium + p.hard && p.direct <= p.total && Array.isArray(p.unlocked) &&
    p.unlocked.length <= ACHIEVEMENTS.length && new Set(p.unlocked).size === p.unlocked.length &&
    p.unlocked.every(id => ACHIEVEMENTS.some(a => a.id === id)) &&
    ['points','best'].every(key => p[key] === undefined || Number.isSafeInteger(p[key]) && p[key] >= 0) && (p.best ?? 0) <= (p.points ?? 0);
}
export function parseState(text) {
  const fallback = { game: null, settings: defaults(), progress: emptyProgress(), scores:emptyScores(), problem: false };
  try {
    if (!text) return fallback;
    const data = JSON.parse(text), settings = data.settings;
    if (data.schema !== 1 || !settings || !Object.hasOwn(LOCALES, settings.language) || !['light','dark'].includes(settings.theme) ||
      !['reducedMotion','showConflicts','tracking'].every(k => typeof settings[k] === 'boolean') ||
      (data.game !== null && !validGame(data.game)) || (settings.tracking && !validProgress(data.progress)) ||
      (data.scores !== undefined && !validScores(data.scores))) {
      return { ...fallback, problem: true };
    }
    settings.musicVolume = Number.isFinite(settings.musicVolume) && settings.musicVolume >= 0 && settings.musicVolume <= 1 ? settings.musicVolume : 0.25;
    settings.musicTrack = typeof settings.musicTrack === 'string' && settings.musicTrack.length < 256 && !/[\\/]/.test(settings.musicTrack) ? settings.musicTrack : DEFAULT_MUSIC_TRACK;
    settings.musicTrack=Object.hasOwn(renamedMusic,settings.musicTrack)?renamedMusic[settings.musicTrack]:settings.musicTrack;
    settings.musicFavorites=Array.isArray(settings.musicFavorites)?[...new Set(settings.musicFavorites.filter(file=>typeof file==='string'&&file.length<256&&!/[\\/]/.test(file)))].slice(0,200):[];
    settings.musicFavoritesOnly=settings.musicFavoritesOnly===true;
    settings.rememberMusic = settings.rememberMusic === true;
    settings.musicEnabled = !settings.rememberMusic || settings.musicEnabled !== false;
    settings.musicMuted = settings.rememberMusic && settings.musicMuted === true;
    settings.energySaver = settings.energySaver === true;
    settings.musicOrder = ['shuffle','sequential'].includes(settings.musicOrder) ? settings.musicOrder : 'shuffle';
    settings.sfxEnabled = typeof settings.sfxEnabled === 'boolean' ? settings.sfxEnabled : true;
    settings.sfxVolume = Number.isFinite(settings.sfxVolume) && settings.sfxVolume >= 0 && settings.sfxVolume <= 1 ? settings.sfxVolume : 0.3;
    if (data.game) { data.game.elapsedMs ??= 0; data.game.mistakes ??= 0; data.game.score ??= null; data.game.credited ??= data.game.completionRecorded; }
    const progress = settings.tracking ? Object.fromEntries(Object.keys(emptyProgress()).map(key => [key,data.progress[key]])) : emptyProgress();
    // Published saves already contain the completed rounds for the new reward.
    if(settings.tracking&&progress.total>=5&&!progress.unlocked.includes('bubbles'))progress.unlocked.push('bubbles');
    const knownScore = data.game?.completionRecorded ? data.game.score?.total || 0 : 0;
    const legacy = validProgress(data.progress) ? data.progress : null;
    const scores = data.scores || { points:Math.max(legacy?.points || 0,knownScore), best:Math.max(legacy?.best || 0,knownScore), solved:Math.max(legacy?.total || 0,knownScore ? 1 : 0) };
    return { game: data.game, settings, progress, scores, problem: false };
  } catch { return { ...fallback, problem: true }; }
}
export function load() {
  try { return parseState(localStorage.getItem(STORAGE_KEY)); }
  catch { return { ...parseState(null), problem:true }; }
}
function validScores(scores) {
  return scores && ['points','best','solved'].every(key => Number.isSafeInteger(scores[key]) && scores[key] >= 0) && scores.best <= scores.points;
}
export function save(game, settings, progress, scores) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 1, game, settings, progress: settings.tracking ? progress : null, scores }));
    return true;
  } catch { return false; }
}
