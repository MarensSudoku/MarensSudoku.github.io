import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SOUND_SPECS, synthesizeSound } from '../scripts/generate-sounds.mjs';
test('eight shipped reef sounds reproduce exactly without clipping or foreign samples', async () => {
  assert.equal(SOUND_SPECS.length, 8);
  for (const spec of SOUND_SPECS) {
    const generated = synthesizeSound(spec.file);
    assert.ok(generated.peak <= 0.7);
    assert.deepEqual(await readFile(new URL('../web/assets/sounds/' + spec.file, import.meta.url)), generated.wav);
  }
});
