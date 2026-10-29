import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
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
await build({ entryPoints:[join(root, 'web/game/aquarium.mjs')], outfile:join(output, 'game/aquarium.mjs'), bundle:true, format:'esm', target:['safari15'], minify:true, legalComments:'linked' });
await cp(join(root, 'node_modules/@babylonjs/core/license.md'), join(output, 'vendor/BABYLON-LICENSE.txt'));
await cp(join(root, 'node_modules/@babylonjs/core/NOTICE.md'), join(output, 'vendor/BABYLON-NOTICE.txt'));
await cp(join(root, 'LICENSE'), join(output, 'LICENSE.txt'));
let notices = await readFile(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
for (const [name, path] of [['Babylon.js 9.32.1','node_modules/@babylonjs/core/license.md'], ['Babylon.js notices','node_modules/@babylonjs/core/NOTICE.md']]) {
  notices += `\n\n${name}\n\n${await readFile(join(root, path), 'utf8')}`;
}
await writeFile(join(output, 'THIRD_PARTY_NOTICES.txt'), notices);
let index = await readFile(join(output, 'index.html'), 'utf8');
const legalSources = {
  imprint:'impressum.html', privacy:'datenschutz.html', code:'LICENSE.txt', notices:'THIRD_PARTY_NOTICES.txt',
  music:'assets/music/LICENSE.txt', sounds:'assets/sounds/LICENSE.txt', commons:'assets/licenses/CC-BY-4.0.txt',
};
for (const [id, path] of Object.entries(legalSources)) {
  const source = await readFile(join(output, path), 'utf8');
  let content;
  if (path.endsWith('.html')) {
    const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
    if (!main) throw new Error(`Legal document has no main content: ${path}`);
    content = main[1].replace(/^<a href="\.\/">[^<]*<\/a>/, '').replace(/<h1>[^<]*<\/h1>/, '');
  } else {
    const escaped = source.replace(/[&<>]/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'}[char]));
    content = `<pre>${escaped}</pre>`;
  }
  const marker = `<!-- legal:${id} -->`;
  if (!index.includes(marker)) throw new Error(`Legal document slot missing: ${id}`);
  index = index.replace(marker, () => content);
}
await writeFile(join(output, 'index.html'), index);
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const assets = [];
for (const path of (await files(output)).sort()) {
  assets.push({ path: relative(output, path).replaceAll('\\', '/'), hash: createHash('sha256').update(await readFile(path)).digest('hex') });
}
const version = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 12);
const versionedIndex=index.replace('<!-- build-version -->',version);
if(versionedIndex===index)throw new Error('Build version marker missing');
await writeFile(join(output,'index.html'),versionedIndex);
assets.find(asset=>asset.path==='index.html').hash=createHash('sha256').update(versionedIndex).digest('hex');
const rangeSource = (await readFile(join(root, 'web/range.mjs'), 'utf8')).replace(/^export /gm, '');
const installSource = (await readFile(join(root, 'web/offline-install.mjs'), 'utf8')).replace(/^export /gm, '');
const source = `${rangeSource}
${installSource}
const PREFIX = 'marenssudoku:' + new URL(self.registration.scope).pathname + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(installAssets(caches, PREFIX, CACHE, ASSETS, self.registration.scope, url => fetch(url, { cache: 'reload' }))));
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
console.log(`Built ${assets.length} files. Version ${version}. Babylon.js 9.32.1 bundled locally.`);
