// Serves bench/ over HTTP, runs bench.html in headless Firefox and prints its results.
// Usage: node serve.mjs [query string, e.g. "medium=1&hard=0&expert=0&master=0"]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIREFOX = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };
const rows = [];
let firefox, profile;

function fmt(r) {
  if (r.ua) return r.ua;
  if (r.timeout || r.error) return `${r.level}: ${r.timeout ? `timeout ${r.limitMs} ms` : r.error}`;
  return `${r.level}: load ${r.load.toFixed(0)} ms, gen ${r.gen.toFixed(0)} ms, analyze ${r.analyze.toFixed(1)} ms -> ` +
    `${r.analysis.level} ${r.analysis.se}, hint ${r.hint.toFixed(1)} ms (${r.technique})`;
}

async function finish() {
  const outFile = (process.argv[2] ?? '').includes('seeded') ? 'results-firefox-seeded.json' : 'results-firefox.json';
  await writeFile(join(root, 'js', outFile), JSON.stringify(rows, null, 2));
  firefox.kill();
  server.close();
  setTimeout(() => rm(profile, { recursive: true, force: true }).catch(() => {}), 2000);
  console.log(`done, ${outFile} written`);
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.end();
    if (req.url === '/log') { const r = JSON.parse(body); rows.push(r); console.log(fmt(r)); }
    if (req.url === '/done') await finish();
    return;
  }
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const data = await readFile(path);
    res.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    // Cross-origin isolation: without it Firefox coarsens performance.now() to 1 ms
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.end(data);
  } catch { res.statusCode = 404; res.end(); }
});

server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/js/bench.html?${process.argv[2] ?? ''}`;
  profile = await mkdtemp(join(tmpdir(), 'nona-ff-'));
  firefox = spawn(FIREFOX, ['--headless', '--no-remote', '--profile', profile, url], { stdio: 'ignore' });
  console.log(`firefox headless -> ${url}`);
});
