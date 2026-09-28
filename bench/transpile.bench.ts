import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import { transform as esbuildTransform } from 'esbuild'
import { transform as rolldownTransform, transformSync as rolldownTransformSync } from 'rolldown/experimental'
import { transpile as oxidaseTranspile } from 'oxidase'
import tsBlankSpace from 'ts-blank-space'
import { transpile as petreaAsync, transpileSync as petreaSync } from 'petrea'
import { transpile as petreaWasmAsync, transpileSync as petreaWasmSync } from 'petrea/wasm'
import { init as initOxbox, transform as oxboxTransform, transformSync as oxboxTransformSync } from 'oxbox'
import { transpile as oxidaseNativeTranspile, transpileAsync as oxidaseNativeAsync } from './oxidase-native.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const corpus: Array<{ rel: string, bytes: number }> = JSON.parse(
  readFileSync(join(root, 'corpus.json'), 'utf8'),
)
const sources = corpus.map(f => ({
  ...f,
  source: readFileSync(join(root, 'vendor/es-toolkit/src', f.rel), 'utf8'),
}))
const totalMB = corpus.reduce((n, f) => n + f.bytes, 0) / 1e6

// sink defeats dead-code elimination across the timed loop
let sink = 0

// vitest 5's module runner wraps ESM exports in getters; calling an imported
// binding inside a timed loop pays a getter access per call. Capture each
// function once so the loops measure the transpilers, not the module runner.
const oxidaseWasm = oxidaseTranspile
const oxidaseNative = oxidaseNativeTranspile
const oxidaseNativeConc = oxidaseNativeAsync
const tbs = tsBlankSpace
const petreaNativeSync = petreaSync
const petreaNativeAsync = petreaAsync
const petreaWasmSyncFn = petreaWasmSync
const petreaWasmAsyncFn = petreaWasmAsync
const esbuildTransformFn = esbuildTransform
const rolldownTransformSyncFn = rolldownTransformSync
const rolldownTransformConc = rolldownTransform
const oxboxTransformSyncFn = oxboxTransformSync
const oxboxTransformConc = oxboxTransform

// oxbox lazily decodes/instantiates its embedded wasm on first call; warm it
// ahead of the timed benches (sync APIs need this in browsers, and it keeps the
// first warmup iteration from paying the one-time init cost).
await initOxbox()

// vitest 5: `bench` is a per-test fixture; registrations run via bench.compare().
// Timing options are Bench-constructor options, passed as the trailing compare
// argument (per-task fnOpts no longer accept them in tinybench 6).
const opts = { time: 3000, warmupTime: 300, warmupIterations: 3 }

test(`es-toolkit src, per-file — ${corpus.length} files / ${totalMB.toFixed(2)} MB per pass`, async ({ bench }) => {
  await bench.compare(
    bench('oxidase (wasm, published)', () => {
      for (const f of sources) sink += oxidaseWasm(f.source).length
    }),

    bench('oxidase (native)', () => {
      for (const f of sources) sink += oxidaseNative(f.source).length
    }),

    bench('oxidase (native, async)', async () => {
      for (const f of sources) sink += (await oxidaseNativeConc(f.source)).length
    }),

    bench('oxidase (native, async, concurrent)', async () => {
      await Promise.all(sources.map(f => oxidaseNativeConc(f.source).then(r => { sink += r.length })))
    }),

    bench('ts-blank-space', () => {
      for (const f of sources) sink += tbs(f.source).length
    }),

    bench('petrea (native, sync)', () => {
      for (const f of sources) sink += petreaNativeSync(f.source).length
    }),

    bench('petrea (native, async)', async () => {
      for (const f of sources) sink += (await petreaNativeAsync(f.source)).length
    }),

    bench('petrea (native, async, concurrent)', async () => {
      await Promise.all(sources.map(f => petreaNativeAsync(f.source).then(r => { sink += r.length })))
    }),

    bench('petrea (wasm, sync)', () => {
      for (const f of sources) sink += petreaWasmSyncFn(f.source).length
    }),

    bench('petrea (wasm, async)', async () => {
      for (const f of sources) sink += (await petreaWasmAsyncFn(f.source)).length
    }),

    bench('petrea (wasm, async, concurrent)', async () => {
      await Promise.all(sources.map(f => petreaWasmAsyncFn(f.source).then(r => { sink += r.length })))
    }),

    bench('esbuild', async () => {
      for (const f of sources) sink += (await esbuildTransformFn(f.source, { loader: 'ts', target: 'esnext' })).code.length
    }),

    bench('esbuild (concurrent)', async () => {
      await Promise.all(sources.map(f => esbuildTransformFn(f.source, { loader: 'ts', target: 'esnext' }).then(r => { sink += r.code.length })))
    }),

    bench('rolldown (transformSync)', () => {
      for (const f of sources) sink += rolldownTransformSyncFn('x.ts', f.source, { lang: 'ts', target: 'esnext' }).code.length
    }),

    bench('rolldown (transform, concurrent)', async () => {
      await Promise.all(sources.map(f => rolldownTransformConc('x.ts', f.source, { lang: 'ts', target: 'esnext' }).then(r => { sink += r.code.length })))
    }),

    bench('oxbox (transformSync)', () => {
      for (const f of sources) sink += oxboxTransformSyncFn('x.ts', f.source, { target: 'esnext' }).code.length
    }),

    bench('oxbox (transform, concurrent)', async () => {
      await Promise.all(sources.map(f => oxboxTransformConc('x.ts', f.source, { target: 'esnext' }).then(r => { sink += r.code.length })))
    }),

    opts,
  )
}, 600_000)
