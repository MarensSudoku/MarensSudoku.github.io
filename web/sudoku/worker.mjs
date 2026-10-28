import { generate } from './engine.mjs';
self.onmessage = ({ data }) => {
  try { self.postMessage({ puzzle: generate(data.difficulty, data.seed) }); }
  catch { self.postMessage({ error: 'generation' }); }
};
