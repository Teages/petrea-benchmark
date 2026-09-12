# petrea benchmark — TypeScript type-strippers vs real-world pipelines

## Environment

<!-- generated:environment:start -->
AMD EPYC 7763 64-Core Processor · Linux 6.17.0-1022-azure · Node.js v24.20.0 · vitest 4.1.11 bench mode.
<!-- generated:environment:end -->

## Results

<!-- generated:results:start -->
| Transpiler | Total best (ms) | Total slow (ms) | Total avg (ms) | Throughput (MB/s) | Speed (oxidase wasm = 1x) |
|---|---|---|---|---|---|
| oxidase (native, async, concurrent) | 7.38 | 10.63 | 7.78 | 194.5 | 2.16x |
| oxidase (native) | 8.23 | 10.71 | 8.39 | 180.3 | 2.00x |
| petrea (native, async, concurrent) | 12.82 | 14.96 | 13.37 | 113.2 | 1.26x |
| petrea (native, sync) | 14.86 | 17.20 | 15.09 | 100.3 | 1.11x |
| oxidase (wasm, published) | 16.37 | 21.30 | 16.79 | 90.1 | 1.00x |
| rolldown (transform, concurrent) | 24.62 | 28.75 | 25.93 | 58.3 | 0.65x |
| rolldown (transformSync) | 33.11 | 36.65 | 33.88 | 44.7 | 0.50x |
| petrea (wasm, sync) | 37.12 | 59.19 | 39.53 | 38.3 | 0.42x |
| petrea (wasm, async, concurrent) | 42.65 | 71.67 | 46.31 | 32.7 | 0.36x |
| oxidase (native, async) | 48.83 | 57.59 | 50.34 | 30.1 | 0.33x |
| petrea (wasm, async) | 51.59 | 79.66 | 54.37 | 27.8 | 0.31x |
| petrea (native, async) | 65.21 | 72.03 | 66.54 | 22.7 | 0.25x |
| ts-blank-space | 59.07 | 89.27 | 66.88 | 22.6 | 0.25x |
| esbuild (concurrent) | 319.85 | 372.94 | 351.39 | 4.3 | 0.05x |
| esbuild | 505.82 | 718.06 | 601.95 | 2.5 | 0.03x |
<!-- generated:results:end -->

Raw output: `bench-output.txt`.

## Notes

- petrea 0.4.1 — native napi binding and `petrea/wasm` (wasm32-wasip1); both entries benchmarked.
- oxidase 0.0.3 — the published npm build is wasm-bindgen only (no native entry).
- ts-blank-space 0.9.0 — pure JS, TypeScript compiler parser.
- rolldown 1.2.8 — `rolldown/experimental` transform (oxc-transform, in-process napi); full TS→JS rewrite, not position-preserving.
- esbuild 0.28.2 — npm JS API, per-file `transform` across the Go service IPC.
- Our changes: oxidase's source (submodule @ `045ea46`, the exact source of the npm release) is built as a local napi binding via `patches/oxidase-native.patch` — a line-for-line mirror of upstream's wasm binding, plus a locally added async API (upstream ships sync-only).
- Corpus: es-toolkit `src/` (submodule @ `9c6ca7d`), 846 files / 1.51 MB; every file accepted by every stripper in strict mode with output length identical to input. Two files excluded (`corpus-excluded.json`): `function/retry.ts` — oxidase 0.0.3 emits output longer than its input; `server/exec.ts` — parameter properties, unsupported by all three.
- Measurement: one timed iteration = transpile all files sequentially, sources preloaded in memory; `concurrent` rows submit all files at once (`Promise.all`) and measure batch wall-clock. Numbers are measured by the GitHub Actions workflow on the runner listed in Environment.

## Reproduce

```sh
npm install
git submodule update --init --depth 1
node prepare.mjs            # build corpus.json + compatibility pre-check
npm run build:oxidase-native  # builds for this platform, needs Rust (a darwin-arm64 .node is prebuilt)
npm run bench
```
