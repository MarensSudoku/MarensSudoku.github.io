export async function sha256(response) {
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
// Verified copies from earlier caches are reused, so an update only downloads changed files.
// A failed install keeps everything it already verified; the next attempt resumes from there.
export async function installAssets(storage, prefix, name, assets, scope, load) {
  const cache = await storage.open(name);
  const earlier = await Promise.all((await storage.keys()).filter(key => key.startsWith(prefix)).map(async key => [key, await storage.open(key)]));
  let downloaded = 0;
  const results = await Promise.allSettled(assets.map(async asset => {
    const url = new URL(asset.path, scope).href;
    for (const [key, old] of earlier) {
      const kept = await old.match(url);
      if (kept && await sha256(kept) === asset.hash) { if (key !== name) await cache.put(url, kept); return; }
    }
    const response = await load(url);
    if (!response.ok) throw new Error('Offline file unavailable');
    if (await sha256(response) !== asset.hash) throw new Error('Offline file integrity mismatch');
    await cache.put(url, response); downloaded++;
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  return downloaded;
}
