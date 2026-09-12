// Explores whether concurrent async transpile calls beat sequential awaits.
// Node's libuv threadpool size is fixed at process start via UV_THREADPOOL_SIZE.
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

const concurrency = Number(process.env.UV_THREADPOOL_SIZE || 4)
const { transpile: petreaAsync } = await import('petrea')
const { transpile: petreaWasmAsync } = await import('petrea/wasm')

const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'))
const sources = corpus.map(f => readFileSync(new URL(`./vendor/es-toolkit/src/${f.rel}`, import.meta.url), 'utf8'))

let sink = 0

async function pooled(items, n, fn) {
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) sink += (await fn(items[i++])).length
  }))
}

async function timed(name, fn, rounds = 7) {
  await fn() // warmup
  const t = []
  for (let r = 0; r < rounds; r++) {
    const start = performance.now()
    await fn()
    t.push(performance.now() - start)
  }
  t.sort((a, b) => a - b)
  console.log(`${name.padEnd(36)} min ${t[0].toFixed(2)}ms  med ${t[(t.length >> 1)].toFixed(2)}ms`)
}

console.log(`UV_THREADPOOL_SIZE=${concurrency}, ${sources.length} files`)
await timed('native async, sequential', () => pooled(sources, 1, petreaAsync))
await timed(`native async, pool×${Math.min(4, sources.length)}`, () => pooled(sources, 4, petreaAsync))
await timed(`native async, pool×${concurrency}`, () => pooled(sources, concurrency, petreaAsync))
await timed(`native async, pool×${concurrency * 2}`, () => pooled(sources, concurrency * 2, petreaAsync))
await timed('native async, unbounded', () => Promise.all(sources.map(s => petreaAsync(s).then(r => { sink += r.length }))))
await timed('wasm async, sequential', () => pooled(sources, 1, petreaWasmAsync))
await timed(`wasm async, pool×${concurrency}`, () => pooled(sources, concurrency, petreaWasmAsync))
await timed('wasm async, unbounded', () => Promise.all(sources.map(s => petreaWasmAsync(s).then(r => { sink += r.length }))))
