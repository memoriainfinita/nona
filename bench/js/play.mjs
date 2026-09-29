// Mid-game hint bench in Node: plays each seeded puzzle with hint_with_candidates only.
// Puzzles come from puzzles-seeded.json, written by `cargo run --release --example play gen`. Usage: node play.mjs
import { Worker } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { summarize } from './play-core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PKG = join(here, '..', 'pkg-node', 'nona_bridge.js');
const CORE = pathToFileURL(join(here, 'play-core.mjs')).href;
const PUZZLE_TIMEOUT_MS = 180_000;
const GLOBAL_TIMEOUT_MS = 30 * 60_000;

const workerSrc = `
const { parentPort, workerData } = require('node:worker_threads');
const { performance } = require('node:perf_hooks');
const m = require(workerData.pkg);
import(workerData.core).then(({ play }) =>
  parentPort.postMessage(play(m, workerData.puzzle, () => performance.now())));
`;

function runOne(puzzle, budgetMs) {
  return new Promise((resolve) => {
    const w = new Worker(workerSrc, { eval: true, workerData: { pkg: PKG, core: CORE, puzzle } });
    const limit = Math.min(PUZZLE_TIMEOUT_MS, budgetMs);
    const timer = setTimeout(() => { w.terminate(); resolve({ puzzle, timeout: true, limitMs: limit }); }, limit);
    w.once('message', (r) => { clearTimeout(timer); w.terminate(); resolve(r); });
    w.once('error', (e) => { clearTimeout(timer); resolve({ puzzle, error: String(e) }); });
  });
}

const puzzles = JSON.parse(readFileSync(join(here, 'puzzles-seeded.json'), 'utf8')).filter((r) => r.puzzle);
const start = Date.now();
const rows = [];
console.log(`node ${process.version}`);
for (const { level, puzzle } of puzzles) {
  const budget = GLOBAL_TIMEOUT_MS - (Date.now() - start);
  if (budget <= 0) { console.log('global timeout reached'); break; }
  const r = { level, ...(await runOne(puzzle, budget)) };
  rows.push(r);
  if (r.timeout || r.error) console.log(`${level}: ${r.timeout ? `timeout ${r.limitMs} ms` : r.error}`);
  else {
    const s = summarize(r.times);
    console.log(`${level}: ${r.steps} hints (${r.eliminations} elim), median ${s.median.toFixed(2)} ms, ` +
      `max ${s.max.toFixed(1)} ms at step ${s.maxStep}, total ${s.total.toFixed(0)} ms`);
  }
}
writeFileSync(join(here, 'results-play-node.json'), JSON.stringify(rows, null, 2));
console.log(`total ${((Date.now() - start) / 1000).toFixed(0)} s, results-play-node.json written`);
