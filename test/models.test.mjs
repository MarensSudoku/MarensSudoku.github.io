import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('aquarium GLBs stay bounded, embedded and free of remote decoder requirements', async () => {
  const manifest = JSON.parse(await readFile(new URL('../web/assets/models/aquarium.json', import.meta.url)));
  assert.equal(manifest.fish.length, 6);
  assert.equal(manifest.fish.filter(fish=>fish.school).length, 2);
  assert.equal(manifest.plants.length, 2);
  const specs = [manifest.reef,...manifest.fish,...manifest.corals,...manifest.plants,manifest.anemone,manifest.rock,manifest.crab];
  assert.equal(new Set(specs.map(spec=>spec.file)).size,17);
  for (const spec of specs) {
    assert.match(spec.file, /^[a-z-]+\.glb$/);
    const buffer = await readFile(new URL('../web/assets/models/' + spec.file, import.meta.url));
    assert.equal(buffer.readUInt32LE(0), 0x46546c67); assert.equal(buffer.readUInt32LE(4), 2);
    assert.equal(buffer.readUInt32LE(8), buffer.length); assert.ok(buffer.length < 8 * 1024 * 1024);
    const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
    assert.equal(gltf.asset.version, '2.0');
    assert.ok((gltf.extensionsUsed || []).every(name => !/draco|meshopt|basisu/i.test(name)));
    assert.ok(gltf.buffers.every(item => !item.uri)); assert.ok(gltf.images.every(item => !item.uri && Number.isInteger(item.bufferView)));
    let triangles = 0;
    for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
      assert.equal(primitive.mode ?? 4, 4); triangles += gltf.accessors[primitive.indices].count / 3;
      const position = gltf.accessors[primitive.attributes.POSITION];
      assert.ok(position.count > 0 && position.min.every(Number.isFinite) && position.max.every(Number.isFinite));
    }
    assert.ok(triangles > 0 && triangles < 10000);
  }
});
