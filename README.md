# petrea benchmark — TypeScript type-strippers vs real-world pipelines

## Environment

<!-- generated:environment:start -->
Apple M4 · macOS 27.0 · Node.js v24.17.0 · vitest 4.1.11 bench mode.
<!-- generated:environment:end -->

## Results

<!-- generated:results:start -->
| Transpiler | Total best (ms) | Total slow (ms) | Total avg (ms) | Throughput (MB/s) | Speed (oxidase wasm = 1x) |
|---|---|---|---|---|---|
| oxidase (native) | 7.39 | 10.96 | 7.50 | 198.2 | 2.15x |
| petrea (native, async, concurrent) | 13.02 | 16.14 | 13.57 | 109.5 | 1.19x |
| petrea (native, sync) | 14.18 | 17.20 | 14.34 | 103.6 | 1.12x |
| oxidase (native, async, concurrent) | 8.17 | 18.96 | 14.63 | 101.6 | 1.10x |
| oxidase (wasm, published) | 15.67 | 20.92 | 16.08 | 92.4 | 1.00x |
| rolldown (transform, concurrent) | 21.19 | 26.81 | 22.03 | 67.4 | 0.73x |
| rolldown (transformSync) | 26.76 | 30.35 | 27.19 | 54.6 | 0.59x |
| oxidase (native, async) | 25.32 | 54.03 | 29.19 | 50.9 | 0.55x |
| petrea (wasm, sync) | 34.27 | 59.02 | 35.99 | 41.3 | 0.45x |
| petrea (native, async) | 38.16 | 46.98 | 39.20 | 37.9 | 0.41x |
| petrea (wasm, async, concurrent) | 38.53 | 65.69 | 40.56 | 36.6 | 0.40x |
| petrea (wasm, async) | 43.75 | 71.04 | 46.12 | 32.2 | 0.35x |
| ts-blank-space | 55.42 | 121.82 | 63.14 | 23.5 | 0.25x |
| esbuild (concurrent) | 312.72 | 380.93 | 342.45 | 4.3 | 0.05x |
| esbuild | 482.36 | 533.32 | 499.41 | 3.0 | 0.03x |
<!-- generated:results:end -->

Raw output: `bench-output.txt`.

## Notes

- petrea 0.4.1 — native napi binding and `petrea/wasm` (wasm32-wasip1); both entries benchmarked.
- oxidase 0.0.3 — the published npm build is wasm-bindgen only (no native entry).
- ts-blank-space 0.9.0 — pure JS, TypeScript compiler parser.
- rolldown 1.2.8 — `rolldown/experimental` transform (oxc-transform, in-process napi); full TS→JS rewrite, not position-preserving.
- esbuild 0.28.2 — npm JS API, per-file `transform` across the Go service IPC.
- Our changes: oxidase's source (submodule @ `045ea46`, the exact source of the npm release) is built as a local napi binding via `patches/oxidase-native.patch` — a line-for-line mirror of upstream's wasm binding, plus a locally added async API (upstream ships sync-only).
- Corpus: es-toolkit `src/` (submodule @ `9c6ca7d`), 793 files / 1.49 MB; every file accepted by every stripper with output length identical to input. One file excluded — an oxidase 0.0.3 length bug (`corpus-excluded.json`).
- Measurement: one timed iteration = transpile all files sequentially, sources preloaded in memory; `concurrent` rows submit all files at once (`Promise.all`) and measure batch wall-clock. Numbers are from an idle-machine run.

## Reproduce

```sh
npm install
git submodule update --init --depth 1
node prepare.mjs            # build corpus.json + compatibility pre-check
npm run build:oxidase-native  # builds for this platform, needs Rust (a darwin-arm64 .node is prebuilt)
npm run bench
```
