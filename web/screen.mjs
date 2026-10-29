export function createScreenWakeLock(api = globalThis.navigator?.wakeLock) {
  let lock = null, pending = false, wanted = false, generation = 0;
  async function acquire() {
    const revision = generation;
    try {
      const result = await api.request('screen');
      if (!wanted || revision !== generation) { await result.release(); return; }
      lock = result;
      result.addEventListener('release', () => { if (lock === result) lock = null; });
    } catch {} finally {
      pending = false;
      if (wanted && revision !== generation) update(true);
    }
  }
  function update(active) {
    if (wanted !== active) { wanted = active; generation++; }
    if (!wanted) {
      const previous = lock; lock = null;
      previous?.release().catch(() => {});
    } else if (!lock && !pending && api?.request) {
      pending = true; void acquire();
    }
  }
  return { update };
}
