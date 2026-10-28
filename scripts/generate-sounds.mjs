import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SAMPLE_RATE = 44100;
export const SOUND_SPECS = [
  { file: '01-zahl-eintragen.wav', duration: 0.16, peak: 0.32 },
  { file: '02-notiz-setzen.wav', duration: 0.10, peak: 0.18 },
  { file: '03-zahl-loeschen.wav', duration: 0.22, peak: 0.28 },
  { file: '04-einheit-geschafft.wav', duration: 0.65, peak: 0.35 },
  { file: '05-neue-perle.wav', duration: 1.00, peak: 0.36 },
  { file: '06-riffsieg.wav', duration: 1.80, peak: 0.40 },
  { file: '07-menue-antippen.wav', duration: 0.08, peak: 0.16 },
  { file: '08-neuer-tauchgang.wav', duration: 0.65, peak: 0.25 },
];
const TAU = Math.PI * 2;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function tone(samples, start, duration, frequency, amplitude, bend = 0, bell = false) {
  const offset = Math.round(start * SAMPLE_RATE), count = Math.round(duration * SAMPLE_RATE);
  for (let i = 0; i < count && offset + i < samples.length; i++) {
    const t = i / SAMPLE_RATE, progress = i / count;
    const attack = Math.sin(Math.min(1, t / 0.006) * Math.PI / 2) ** 2;
    const release = Math.min(1, (count - i - 1) / (SAMPLE_RATE * 0.012)) ** 2;
    const decay = Math.exp(-(bell ? 5.5 : 6.5) * progress);
    const phase = TAU * (frequency * t + bend * 0.026 * (1 - Math.exp(-t / 0.026)));
    const body = Math.sin(phase) + (bell ? 0.18 * Math.sin(phase * 2.03) * Math.exp(-12 * progress) : 0.07 * Math.sin(phase * 1.97));
    samples[offset + i] += amplitude * body * attack * release * decay;
  }
}
function bubble(samples, start, duration, frequency, amplitude) {
  tone(samples, start, duration, frequency, amplitude, frequency * 0.9);
}
function pearl(samples, start, duration, frequency, amplitude) {
  tone(samples, start, duration, frequency, amplitude, 0, true);
}
function wash(samples, start, duration, amplitude, seed) {
  let state = seed >>> 0, low = 0, smooth = 0, body = 0;
  const offset = Math.round(start * SAMPLE_RATE), count = Math.round(duration * SAMPLE_RATE);
  for (let i = 0; i < count && offset + i < samples.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    low += 0.12 * (state / 2147483648 - 1 - low);
    smooth += 0.12 * (low - smooth);
    body += 0.018 * (smooth - body);
    samples[offset + i] += amplitude * (smooth - body) * Math.sin(Math.PI * i / count) ** 2;
  }
}

export function synthesizeSound(file) {
  const spec = SOUND_SPECS.find(item => item.file === file);
  assert.ok(spec, `Unknown sound: ${file}`);
  const samples = new Float64Array(Math.round(spec.duration * SAMPLE_RATE));
  switch (file) {
    case '01-zahl-eintragen.wav': bubble(samples, 0.002, 0.145, 510, 1); break;
    case '02-notiz-setzen.wav': pearl(samples, 0.002, 0.087, 1050, 1); break;
    case '03-zahl-loeschen.wav': bubble(samples, 0.002, 0.205, 320, 1); break;
    case '04-einheit-geschafft.wav':
      [620, 780, 930].forEach((f, i) => { bubble(samples, 0.003 + i * 0.14, 0.17, f * 0.58, 0.36); pearl(samples, 0.02 + i * 0.14, 0.32, f, 0.65); });
      break;
    case '05-neue-perle.wav':
      wash(samples, 0.002, 0.16, 0.2, 51);
      pearl(samples, 0.09, 0.68, 740, 0.9); pearl(samples, 0.25, 0.64, 1110, 0.45);
      bubble(samples, 0.45, 0.14, 590, 0.25); bubble(samples, 0.59, 0.16, 690, 0.18);
      break;
    case '06-riffsieg.wav':
      [0.003, 0.11, 0.23].forEach((start, i) => bubble(samples, start, 0.18, 400 + i * 100, 0.23));
      [660, 880, 1046.5, 1320].forEach((f, i) => pearl(samples, 0.12 + i * 0.19, 1.02, f, i === 3 ? 0.62 : 0.75));
      break;
    case '07-menue-antippen.wav':
      tone(samples, 0.002, 0.066, 710, 1, -90);
      break;
    case '08-neuer-tauchgang.wav':
      wash(samples, 0.002, 0.51, 1, 81);
      bubble(samples, 0.33, 0.16, 500, 0.22); bubble(samples, 0.46, 0.17, 680, 0.17);
      break;
  }

  const window = samples.map((_, i) => {
    const seconds = i / SAMPLE_RATE, left = Math.max(0, Math.min(1, (seconds - 0.001) / 0.004));
    const right = Math.max(0, Math.min(1, (spec.duration - seconds - 0.002) / 0.012));
    return Math.sin(left * Math.PI / 2) ** 2 * Math.sin(right * Math.PI / 2) ** 2;
  });
  for (let i = 0; i < samples.length; i++) samples[i] *= window[i];
  const dc = samples.reduce((sum, value) => sum + value, 0) / window.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < samples.length; i++) samples[i] -= dc * window[i];
  const sourcePeak = samples.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
  assert.ok(sourcePeak > 0);

  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24); wav.writeUInt32LE(SAMPLE_RATE * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  let peak = 0, energy = 0, sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.round(samples[i] / sourcePeak * spec.peak * 32767);
    assert.ok(Number.isFinite(value) && Math.abs(value) <= 32767 * 0.7);
    wav.writeInt16LE(value, 44 + i * 2);
    samples[i] = value / 32768; peak = Math.max(peak, Math.abs(samples[i])); energy += samples[i] ** 2; sum += samples[i];
  }
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(4), wav.length - 8); assert.equal(wav.readUInt32LE(40), samples.length * 2);
  assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.ok(samples.subarray(0, 44).every(value => value === 0));
  assert.ok(samples.subarray(samples.length - 88).every(value => value === 0));
  assert.ok(Math.abs(sum / samples.length) < 0.00001);
  const rms = Math.sqrt(energy / samples.length); assert.ok(rms > 0.001 && rms < 0.3);
  return { wav, samples, duration: spec.duration, peak, rms };
}

export async function generateSounds() {
  const directory = resolve(root, 'web/assets/sounds');
  assert.equal(relative(root, directory).replaceAll('\\', '/'), 'web/assets/sounds');
  await mkdir(directory, { recursive: true });
  for (const spec of SOUND_SPECS) {
    const { wav, duration, peak, rms } = synthesizeSound(spec.file);
    const path = join(directory, spec.file);
    try { await writeFile(path, wav, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      assert.ok(wav.equals(await readFile(path)), `Refusing to overwrite a different existing sound: ${path}`);
    }
    console.log(`${spec.file}: ${duration.toFixed(2)} s, peak ${peak.toFixed(4)}, RMS ${rms.toFixed(4)}, ${wav.length} bytes`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateSounds();
