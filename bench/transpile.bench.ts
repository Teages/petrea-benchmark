import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bench, describe } from 'vitest'
import { transform as esbuildTransform } from 'esbuild'
import { transform as rolldownTransform, transformSync as rolldownTransformSync } from 'rolldown/experimental'
import { transpile as oxidaseTranspile } from 'oxidase'
import tsBlankSpace from 'ts-blank-space'
import { transpile as petreaAsync, transpileSync as petreaSync } from 'petrea'
import { transpile as petreaWasmAsync, transpileSync as petreaWasmSync } from 'petrea/wasm'
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

describe(`es-toolkit src, per-file — ${corpus.length} files / ${totalMB.toFixed(2)} MB per pass`, () => {
  bench('oxidase (wasm, published)', () => {
    for (const f of sources) sink += oxidaseTranspile(f.source).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('oxidase (native)', () => {
    for (const f of sources) sink += oxidaseNativeTranspile(f.source).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('oxidase (native, async)', async () => {
    for (const f of sources) sink += (await oxidaseNativeAsync(f.source)).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('oxidase (native, async, concurrent)', async () => {
    await Promise.all(sources.map(f => oxidaseNativeAsync(f.source).then(r => { sink += r.length })))
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('ts-blank-space', () => {
    for (const f of sources) sink += tsBlankSpace(f.source).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('petrea (native, sync)', () => {
    for (const f of sources) sink += petreaSync(f.source).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('petrea (native, async)', async () => {
    for (const f of sources) sink += (await petreaAsync(f.source)).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('petrea (native, async, concurrent)', async () => {
    await Promise.all(sources.map(f => petreaAsync(f.source).then(r => { sink += r.length })))
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('petrea (wasm, sync)', () => {
    for (const f of sources) sink += petreaWasmSync(f.source).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('petrea (wasm, async)', async () => {
    for (const f of sources) sink += (await petreaWasmAsync(f.source)).length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('petrea (wasm, async, concurrent)', async () => {
    await Promise.all(sources.map(f => petreaWasmAsync(f.source).then(r => { sink += r.length })))
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('esbuild', async () => {
    for (const f of sources) sink += (await esbuildTransform(f.source, { loader: 'ts', target: 'esnext' })).code.length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('esbuild (concurrent)', async () => {
    await Promise.all(sources.map(f => esbuildTransform(f.source, { loader: 'ts', target: 'esnext' }).then(r => { sink += r.code.length })))
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('rolldown (transformSync)', () => {
    for (const f of sources) sink += rolldownTransformSync('x.ts', f.source, { lang: 'ts', target: 'esnext' }).code.length
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })

  bench('rolldown (transform, concurrent)', async () => {
    await Promise.all(sources.map(f => rolldownTransform('x.ts', f.source, { lang: 'ts', target: 'esnext' }).then(r => { sink += r.code.length })))
  }, { time: 3000, warmupTime: 300, warmupIterations: 3 })
})
