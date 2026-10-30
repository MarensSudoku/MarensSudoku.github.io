import test from 'node:test';
import assert from 'node:assert/strict';
import { installAssets, sha256,selectedCache,selectCache } from '../web/offline-install.mjs';

function cacheStorage() {
  const caches = new Map();
  return {
    async open(name) {
      if (!caches.has(name)) {
        const files = new Map();
        caches.set(name, { async match(url) { return files.get(url)?.clone(); }, async put(url, response) { files.set(url, response); } });
      }
      return caches.get(name);
    },
    async keys() { return [...caches.keys()]; },
  };
}

test('offline updates download only changed files and resume after a failed download', async () => {
  const scope = 'https://reef.test/', storage = cacheStorage(), fetched = [];
  const assets = async files => Promise.all(Object.entries(files).map(async ([path, text]) => ({ path, hash:await sha256(new Response(text)) })));
  const load = files => async url => {
    const path = url.slice(scope.length); fetched.push(path);
    return files[path] === undefined ? new Response('', { status:404 }) : new Response(files[path]);
  };
  const first = { 'a.txt':'reef', 'b.txt':'sand', 'c.txt':'shell' };
  assert.equal(await installAssets(storage, 'p:', 'p:1', await assets(first), scope, load(first)), 3);

  const second = { ...first, 'b.txt':'coral' }; fetched.length = 0;
  assert.equal(await installAssets(storage, 'p:', 'p:2', await assets(second), scope, load(second)), 1);
  assert.deepEqual(fetched, ['b.txt']);
  assert.equal(await (await (await storage.open('p:2')).match(scope + 'a.txt')).text(), 'reef');

  const third = { ...second, 'c.txt':'pearl', 'd.txt':'wave' }, offline = { ...third };
  delete offline['d.txt'];
  await assert.rejects(installAssets(storage, 'p:', 'p:3', await assets(third), scope, load(offline)), /unavailable/);
  fetched.length = 0;
  assert.equal(await installAssets(storage, 'p:', 'p:3', await assets(third), scope, load(third)), 1);
  assert.deepEqual(fetched, ['d.txt']);

  const expected = await assets({ ...third, 'e.txt':'foam' });
  await assert.rejects(installAssets(storage, 'p:', 'p:4', expected, scope, load({ ...third, 'e.txt':'tampered' })), /integrity/);
});

test('the approved offline version survives a worker restart until an explicit update',async()=>{
  const storage=cacheStorage(),scope='https://reef.test/',prefix='reef:';
  await storage.open(prefix+'v2');await storage.open(prefix+'v3');
  assert.equal(await selectedCache(storage,prefix,scope,prefix+'v2'),prefix+'v2');
  await selectCache(storage,prefix,scope,prefix+'v2');
  assert.equal(await selectedCache(storage,prefix,scope,prefix+'v3'),prefix+'v2');
  await selectCache(storage,prefix,scope,prefix+'v3');
  assert.equal(await selectedCache(storage,prefix,scope,prefix+'v2'),prefix+'v3');
  await assert.rejects(selectCache(storage,prefix,scope,'other:v4'),/unavailable/);
  await assert.rejects(selectCache(storage,prefix,scope,prefix+'missing'),/unavailable/);
});
