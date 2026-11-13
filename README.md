# petrea benchmark — TypeScript type-strippers vs real-world pipelines

## Environment

<!-- generated:environment:start -->
AMD EPYC 9V45 96-Core Processor · Linux 6.17.0-1022-azure · Node.js v24.21.0 · vitest 5.0.2 bench mode.
<!-- generated:environment:end -->

## Results

<!-- generated:results:start -->
| Transpiler | Total best (ms) | Total slow (ms) | Total avg (ms) | Throughput (MB/s) | Speed (oxidase wasm = 1x) |
|---|---|---|---|---|---|
| oxidase (native, async, concurrent) | 2.01 | 4.99 | 2.14 | 708.5 | 4.21x |
| petrea (native, async, concurrent) | 3.29 | 6.62 | 3.43 | 441.3 | 2.63x |
| oxidase (native) | 4.66 | 12.41 | 4.78 | 316.7 | 1.88x |
| rolldown (transform, concurrent) | 5.50 | 13.98 | 6.11 | 247.4 | 1.47x |
| petrea (native, sync) | 7.76 | 15.11 | 7.95 | 190.3 | 1.13x |
| oxidase (wasm, published) | 8.80 | 12.39 | 9.00 | 168.1 | 1.00x |
| oxbox (transform, concurrent) | 8.66 | 21.89 | 10.73 | 141.0 | 0.84x |
| rolldown (transformSync) | 13.55 | 22.61 | 13.90 | 108.8 | 0.65x |
| oxbox (transformSync) | 17.44 | 20.16 | 17.78 | 85.1 | 0.51x |
| petrea (wasm, sync) | 17.74 | 22.48 | 18.12 | 83.5 | 0.50x |
| oxidase (native, async) | 18.92 | 30.95 | 20.57 | 73.5 | 0.44x |
| petrea (wasm, async, concurrent) | 19.89 | 36.78 | 21.30 | 71.0 | 0.42x |
| petrea (wasm, async) | 21.81 | 23.55 | 22.34 | 67.7 | 0.40x |
| petrea (native, async) | 22.55 | 74.69 | 25.29 | 59.8 | 0.36x |
| ts-blank-space | 29.75 | 59.12 | 32.24 | 46.9 | 0.28x |
| esbuild (concurrent) | 103.06 | 140.38 | 118.93 | 12.7 | 0.08x |
| esbuild | 311.88 | 359.94 | 333.32 | 4.5 | 0.03x |
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
