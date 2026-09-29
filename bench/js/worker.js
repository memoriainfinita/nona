import init, * as m from '../pkg-web/nona_bridge.js';

self.onmessage = async ({ data: { level, seed } }) => {
  let t = performance.now();
  await init();
  const load = performance.now() - t;
  t = performance.now();
  const puzzle = seed ? m.generate_seeded(level, BigInt(seed)) : m.generate(level);
  const gen = performance.now() - t;
  t = performance.now();
  const analysis = JSON.parse(m.analyze(puzzle));
  const analyze = performance.now() - t;
  t = performance.now();
  const hint = JSON.parse(m.hint(puzzle));
  const hintMs = performance.now() - t;
  self.postMessage({ puzzle, load, gen, analysis, analyze, hint: hintMs, technique: hint && hint.technique });
};
