// Builds engine/ to engine/pkg: cargo (wasm32) -> wasm-bindgen (web target) -> wasm-opt.
// Needs cargo, the wasm32-unknown-unknown target and wasm-bindgen-cli matching engine/Cargo.toml.
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const engine = `${root}engine`
const wasm = `${engine}/target/wasm32-unknown-unknown/release/nona_engine.wasm`
const out = `${engine}/pkg`
const wasmOpt = `${root}node_modules/binaryen/bin/wasm-opt`
const run = (cmd, args) => execFileSync(cmd, args, { cwd: engine, stdio: 'inherit' })

run('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown'])
run('wasm-bindgen', [wasm, '--target', 'web', '--out-dir', out])
run(process.execPath, [wasmOpt, '-O3', '--enable-bulk-memory', '--enable-nontrapping-float-to-int',
  '--enable-sign-ext', '--enable-reference-types', '--enable-multivalue',
  `${out}/nona_engine_bg.wasm`, '-o', `${out}/nona_engine_bg.wasm`])
console.log(`engine/pkg/nona_engine_bg.wasm: ${(statSync(`${out}/nona_engine_bg.wasm`).size / 1024).toFixed(0)} KiB`)
