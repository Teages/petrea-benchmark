# petrea benchmark — TypeScript type-strippers vs real-world pipelines

## Environment

<!-- generated:environment:start -->
AMD EPYC 9V45 96-Core Processor · Linux 7.0.0-1019-azure · Node.js v24.22.2 · vitest 5.0.2 bench mode.
<!-- generated:environment:end -->

## Results

<!-- generated:results:start -->
| Transpiler | Total best (ms) | Total slow (ms) | Total avg (ms) | Throughput (MB/s) | Speed (oxidase wasm = 1x) |
|---|---|---|---|---|---|
| oxidase (native, async, concurrent) | 2.10 | 3.45 | 2.24 | 676.2 | 4.34x |
| petrea (native, async, concurrent) | 3.48 | 6.14 | 4.12 | 367.1 | 2.35x |
| oxidase (native) | 5.02 | 10.67 | 5.28 | 286.6 | 1.84x |
| rolldown (transform, concurrent) | 6.07 | 12.09 | 6.87 | 220.3 | 1.41x |
| typestrip | 6.43 | 16.37 | 6.88 | 219.8 | 1.41x |
| petrea (native, sync) | 8.52 | 9.58 | 8.85 | 170.9 | 1.10x |
| oxidase (wasm, published) | 9.35 | 14.33 | 9.70 | 156.0 | 1.00x |
| oxbox (transform, concurrent) | 10.51 | 26.10 | 12.82 | 118.0 | 0.76x |
| rolldown (transformSync) | 14.69 | 29.70 | 15.39 | 98.3 | 0.63x |
| oxidase (native, async) | 18.88 | 33.26 | 20.19 | 74.9 | 0.48x |
| petrea (wasm, sync) | 19.24 | 43.00 | 20.69 | 73.1 | 0.47x |
| oxbox (transformSync) | 20.10 | 25.32 | 21.04 | 71.9 | 0.46x |
| petrea (wasm, async, concurrent) | 23.26 | 33.51 | 24.18 | 62.6 | 0.40x |
| petrea (native, async) | 22.50 | 55.80 | 25.03 | 60.4 | 0.39x |
| petrea (wasm, async) | 24.03 | 43.36 | 25.63 | 59.0 | 0.38x |
| ts-blank-space | 33.46 | 67.17 | 38.28 | 39.5 | 0.25x |
| esbuild (concurrent) | 123.67 | 167.78 | 146.20 | 10.3 | 0.07x |
| esbuild | 340.95 | 406.91 | 370.37 | 4.1 | 0.03x |
<!-- generated:results:end -->

Raw output: `bench-output.txt`.

## Notes

- petrea 0.5.1 — native napi binding and `petrea/wasm` (wasm32-wasip1); both entries benchmarked.
- oxidase 0.0.3 — the published npm build is wasm-bindgen only (no native entry).
- ts-blank-space 0.9.0 — pure JS, TypeScript compiler parser.
- typestrip (tangled.org/nibling.dev/typestrip, submodule @ `7f4973a`) — WasmGC engine (zero imports), `transformSync` erase mode: blank-in-place like ts-blank-space; strict by default (no `onError` → `UnsupportedSyntaxError`).
- oxbox 0.1.0 — oxc parser + transformer as a single portable wasm module (emnapi host, async APIs on worker threads); same oxc-transform API, full TS→JS rewrite, not position-preserving.
- rolldown 1.2.11 — `rolldown/experimental` transform (oxc-transform, in-process napi); full TS→JS rewrite, not position-preserving.
- esbuild 0.28.2 — npm JS API, per-file `transform` across the Go service IPC.
- Our changes: oxidase's source (submodule @ `045ea46`, the exact source of the npm release) is built as a local napi binding via `patches/oxidase-native.patch` — a line-for-line mirror of upstream's wasm binding, plus a locally added async API (upstream ships sync-only).
- Our changes: typestrip has no npm release (upstream repo is `private: true`), so its JS wrapper comes from the vendored submodule and the engine is built from pinned sources via `build-typestrip-wasm.sh` — zena-cli built from elematic/zena @ `a7c1d2cd` (Rust + Node 25, shallow-cloned into `.build/`), then typestrip's own `scripts/build.sh` with binaryen. CI builds it fresh each run (zena workspace cached); the committed `native/typestrip-erase.wasm` (platform-independent, 30 kB / 12.6 kB gzip, matching upstream's README table) is a convenience copy for local runs.
- Corpus: es-toolkit `src/` (submodule @ `9c6ca7d`), 846 files / 1.51 MB; every file accepted by every stripper in strict mode with output length identical to input. Two files excluded (`corpus-excluded.json`): `function/retry.ts` — oxidase 0.0.3 emits output longer than its input; `server/exec.ts` — parameter properties, unsupported by all three.
- Measurement: one timed iteration = transpile all files sequentially, sources preloaded in memory; `concurrent` rows submit all files at once (`Promise.all`) and measure batch wall-clock. Numbers are measured by the GitHub Actions workflow on the runner listed in Environment.

## Reproduce

```sh
npm install
git submodule update --init --depth 1
node prepare.mjs            # build corpus.json + compatibility pre-check
npm run build:oxidase-native  # builds for this platform, needs Rust (a darwin-arm64 .node is prebuilt)
npm run build:typestrip-wasm  # rebuilds the engine from source, needs Node 25 + Rust (a prebuilt wasm is committed)
npm run bench
```
