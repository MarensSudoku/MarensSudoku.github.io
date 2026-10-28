import { emptyProgress, validGame, ACHIEVEMENTS } from './sudoku/model.mjs';
import { DEFAULT_MUSIC_TRACK } from './music.mjs';
export const STORAGE_KEY = 'marenssudoku:state:v1';
export const defaults = () => ({ language: navigator.language.startsWith('de') ? 'de' : 'en', theme: 'light', reducedMotion: false, showConflicts: true, tracking: false, musicVolume: 0.25, musicTrack: DEFAULT_MUSIC_TRACK, musicEnabled: true, sfxEnabled: true, sfxVolume: 0.3 });
function validProgress(p) {
  return p && ['total','easy','medium','hard','direct'].every(k => Number.isSafeInteger(p[k]) && p[k] >= 0) &&
    p.total === p.easy + p.medium + p.hard && p.direct <= p.total && Array.isArray(p.unlocked) &&
    p.unlocked.length <= ACHIEVEMENTS.length && new Set(p.unlocked).size === p.unlocked.length &&
    p.unlocked.every(id => ACHIEVEMENTS.some(a => a.id === id)) &&
    ['points','best'].every(key => p[key] === undefined || Number.isSafeInteger(p[key]) && p[key] >= 0) && (p.best ?? 0) <= (p.points ?? 0);
}
export function load() {
  const fallback = { game: null, settings: defaults(), progress: emptyProgress(), problem: false };
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return fallback;
    const data = JSON.parse(text), settings = data.settings;
    if (data.schema !== 1 || !settings || !['de','en'].includes(settings.language) || !['light','dark'].includes(settings.theme) ||
      !['reducedMotion','showConflicts','tracking'].every(k => typeof settings[k] === 'boolean') ||
      (data.game !== null && !validGame(data.game)) || (settings.tracking && !validProgress(data.progress))) {
      return { ...fallback, problem: true };
    }
    settings.musicVolume = Number.isFinite(settings.musicVolume) && settings.musicVolume >= 0 && settings.musicVolume <= 1 ? settings.musicVolume : 0.25;
    settings.musicTrack = typeof settings.musicTrack === 'string' && settings.musicTrack.length < 256 && !/[\\/]/.test(settings.musicTrack) ? settings.musicTrack : DEFAULT_MUSIC_TRACK;
    settings.musicEnabled = true;
    settings.sfxEnabled = typeof settings.sfxEnabled === 'boolean' ? settings.sfxEnabled : true;
    settings.sfxVolume = Number.isFinite(settings.sfxVolume) && settings.sfxVolume >= 0 && settings.sfxVolume <= 1 ? settings.sfxVolume : 0.3;
    if (data.game) { data.game.elapsedMs ??= 0; data.game.mistakes ??= 0; data.game.score ??= null; }
    const progress = settings.tracking ? { ...data.progress, points:data.progress.points ?? 0, best:data.progress.best ?? 0 } : emptyProgress();
    return { game: data.game, settings, progress, problem: false };
  } catch { return { ...fallback, problem: true }; }
}
export function save(game, settings, progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 1, game, settings, progress: settings.tracking ? progress : null }));
    return true;
  } catch { return false; }
}
