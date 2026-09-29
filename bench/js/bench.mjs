// WASM timing bench: generate, analyze and hint per level, one worker per puzzle.
// Usage: node bench.mjs [--seeded] [level=n ...]. --seeded uses seed i for the i-th puzzle of each level
import { Worker } from 'node:worker_threads';
import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PKG = join(here, '..', 'pkg-node', 'nona_bridge.js');
const WASM = join(here, '..', 'pkg-node', 'nona_bridge_bg.wasm');

const CALL_TIMEOUT_MS = 180_000;
const GLOBAL_TIMEOUT_MS = 30 * 60_000;
const counts = { medium: 10, hard: 5, expert: 5, master: 3 };
const seeded = process.argv.includes('--seeded');
for (const arg of process.argv.slice(2).filter((a) => a !== '--seeded')) {
  const [level, n] = arg.split('=');
  counts[level] = Number(n);
}

const workerSrc = `
const { parentPort, workerData } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
let t = performance.now();
const m = require(workerData.pkg);
const load = performance.now() - t;
t = performance.now();
const puzzle = workerData.seed ? m.generate_seeded(workerData.level, BigInt(workerData.seed)) : m.generate(workerData.level);
const gen = performance.now() - t;
t = performance.now();
const analysis = JSON.parse(m.analyze(puzzle));
const analyze = performance.now() - t;
t = performance.now();
const hint = JSON.parse(m.hint(puzzle));
const hintMs = performance.now() - t;
parentPort.postMessage({ puzzle, load, gen, analysis, analyze, hint: hintMs, technique: hint && hint.technique });
`;

function runOne(level, seed, budgetMs) {
  return new Promise((resolve) => {
    const w = new Worker(workerSrc, { eval: true, workerData: { pkg: PKG, level, seed } });
    const limit = Math.min(CALL_TIMEOUT_MS, budgetMs);
    const timer = setTimeout(() => { w.terminate(); resolve({ timeout: true, limitMs: limit }); }, limit);
    w.once('message', (r) => { clearTimeout(timer); w.terminate(); resolve(r); });
    w.once('error', (e) => { clearTimeout(timer); resolve({ error: String(e) }); });
  });
}

const start = Date.now();
const rows = [];
console.log(`node ${process.version}, wasm ${(statSync(WASM).size / 1024).toFixed(0)} KiB`);
outer: for (const [level, n] of Object.entries(counts)) {
  for (let i = 0; i < n; i++) {
    const budget = GLOBAL_TIMEOUT_MS - (Date.now() - start);
    if (budget <= 0) { console.log('global timeout reached'); break outer; }
    const r = await runOne(level, seeded ? i + 1 : 0, budget);
    rows.push({ level, ...r });
    if (r.timeout || r.error) {
      console.log(`${level} #${i + 1}: ${r.timeout ? `timeout ${r.limitMs} ms` : r.error}`);
    } else {
      console.log(`${level} #${i + 1}: load ${r.load.toFixed(0)} ms, gen ${r.gen.toFixed(0)} ms, ` +
        `analyze ${r.analyze.toFixed(1)} ms -> ${r.analysis.level} ${r.analysis.se}, ` +
        `hint ${r.hint.toFixed(1)} ms (${r.technique})`);
    }
  }
}

console.log('\nlevel      n  gen min-max ms        analyze max ms  hint max ms  levels from analyze');
for (const level of Object.keys(counts)) {
  const ok = rows.filter((r) => r.level === level && r.puzzle);
  const bad = rows.filter((r) => r.level === level && !r.puzzle).length;
  if (!ok.length) { console.log(`${level.padEnd(9)} 0  (${bad} failed)`); continue; }
  const gens = ok.map((r) => r.gen);
  const got = [...new Set(ok.map((r) => r.analysis.level))].join(', ');
  console.log(`${level.padEnd(9)} ${String(ok.length).padStart(2)}  ` +
    `${Math.min(...gens).toFixed(0)}-${Math.max(...gens).toFixed(0)}`.padEnd(22) +
    `${Math.max(...ok.map((r) => r.analyze)).toFixed(1)}`.padEnd(16) +
    `${Math.max(...ok.map((r) => r.hint)).toFixed(1)}`.padEnd(13) +
    got + (bad ? `  (${bad} failed)` : ''));
}
const outFile = seeded ? 'results-seeded.json' : 'results.json';
writeFileSync(join(here, outFile), JSON.stringify(rows, null, 2));
console.log(`\ntotal ${((Date.now() - start) / 1000).toFixed(0)} s, ${outFile} written`);
