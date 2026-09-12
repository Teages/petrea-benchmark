// Explores rolldown's transform API (oxc-transform based) on the same
// 793-file corpus as the strippers.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { transform as rdTransform, transformSync as rdTransformSync } from 'rolldown/experimental'

const root = new URL('.', import.meta.url).pathname
const corpus = JSON.parse(readFileSync(join(root, 'corpus.json'), 'utf8'))
const srcRoot = join(root, 'vendor/es-toolkit/src')
const sources = corpus.map(f => readFileSync(join(srcRoot, f.rel), 'utf8'))
let sink = 0

async function timed(name, fn, rounds) {
  const t = []
  for (let r = 0; r < rounds; r++) {
    const start = performance.now()
    await fn()
    t.push(performance.now() - start)
  }
  t.sort((a, b) => a - b)
  console.log(`${name.padEnd(44)} min ${t[0].toFixed(1)}ms  med ${t[t.length >> 1].toFixed(1)}ms`)
}

// sanity
const sample = sources[0]
const a = rdTransformSync('a.ts', sample, { lang: 'ts', target: 'esnext' })
const b = await rdTransform('b.ts', sample, { lang: 'ts', target: 'esnext' })
console.log('rolldown sample ok:', a.code.includes('export') && a.code === b.code, '| errors:', a.errors.length)

let failures = 0
for (const s of sources) {
  const r = rdTransformSync('x.ts', s, { lang: 'ts', target: 'esnext' })
  if (r.errors.length > 0) failures++
  sink += r.code.length
}
console.log('rolldown transformSync corpus failures:', failures, '/', corpus.length)

await timed('rolldown transformSync ×793 sequential', () => {
  for (const s of sources) sink += rdTransformSync('x.ts', s, { lang: 'ts', target: 'esnext' }).code.length
}, 5)

await timed('rolldown transform async ×793 sequential', async () => {
  for (const s of sources) sink += (await rdTransform('x.ts', s, { lang: 'ts', target: 'esnext' })).code.length
}, 5)

await timed('rolldown transform async ×793 concurrent', async () => {
  await Promise.all(sources.map(s => rdTransform('x.ts', s, { lang: 'ts', target: 'esnext' }).then(r => { sink += r.code.length })))
}, 5)
