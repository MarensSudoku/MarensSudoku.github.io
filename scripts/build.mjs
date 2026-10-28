import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
if (relative(root, output) !== 'dist') throw new Error('Unexpected build output path');
await rm(output, { recursive: true, force: true });
await cp(join(root, 'web'), output, { recursive: true, filter: source => !source.endsWith('.md') });
const musicFiles = (await readdir(join(output, 'assets/music'))).filter(file => /\.(mp3|ogg|wav|m4a)$/i.test(file)).sort();
await writeFile(join(output, 'assets/music/tracks.json'), JSON.stringify(musicFiles));
for (const folder of ['music', 'sounds']) {
  await cp(join(root, 'web/assets', folder, 'LICENSE.md'), join(output, 'assets', folder, 'LICENSE.txt'));
}
await mkdir(join(output, 'vendor'), { recursive: true });
await cp(join(root, 'node_modules/phaser/dist/phaser.esm.min.js'), join(output, 'vendor/phaser.esm.min.js'));
await cp(join(root, 'node_modules/phaser/LICENSE.md'), join(output, 'vendor/PHASER-LICENSE.txt'));
await cp(join(root, 'LICENSE'), join(output, 'LICENSE.txt'));
let notices = await readFile(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
for (const [name, path] of [['Phaser 4.2.1','node_modules/phaser/LICENSE.md'], ['EventEmitter3','node_modules/eventemitter3/LICENSE']]) {
  notices += `\n\n${name}\n\n${await readFile(join(root, path), 'utf8')}`;
}
await writeFile(join(output, 'THIRD_PARTY_NOTICES.txt'), notices);
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const assets = [];
for (const path of (await files(output)).sort()) {
  assets.push({ path: relative(output, path).replaceAll('\\', '/'), hash: createHash('sha256').update(await readFile(path)).digest('hex') });
}
const version = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 12);
const rangeSource = (await readFile(join(root, 'web/range.mjs'), 'utf8')).replace(/^export /gm, '');
const source = `${rangeSource}
const PREFIX = 'marenssudoku:' + new URL(self.registration.scope).pathname + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    await Promise.all(ASSETS.map(async asset => {
      const url = new URL(asset.path, self.registration.scope).href;
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error('Offline file unavailable');
      const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
      const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== asset.hash) throw new Error('Offline file integrity mismatch');
      await cache.put(url, response);
    }));
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => client.url.startsWith(self.registration.scope));
  if (windows.length <= 1) await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
})()));
self.addEventListener('message', event => { if (event.data === 'ACTIVATE') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = event.request.mode === 'navigate' && new URL(event.request.url).pathname === new URL(self.registration.scope).pathname ? new URL('index.html', self.registration.scope).href : event.request;
    const response = await cache.match(key) || await fetch(event.request);
    return event.request.headers.has('Range') && !event.request.headers.has('If-Range') ? rangeResponse(response, event.request.headers.get('Range')) : response;
  })());
});`;
await writeFile(join(output, 'sw.js'), source);
console.log(`Built ${assets.length} files. Version ${version}. Phaser 4.2.1 bundled locally.`);
