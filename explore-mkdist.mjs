// Measures mkdist's overhead over raw esbuild.transform on the same corpus,
// to decide which one represents the "real-world pipeline" row in the bench.
import { cpSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { mkdist } from 'mkdist'
import { transform as esbuildTransform } from 'esbuild'

const root = new URL('.', import.meta.url).pathname
const corpus = JSON.parse(readFileSync(join(root, 'corpus.json'), 'utf8'))
const srcRoot = join(root, 'vendor/es-toolkit/src')
const staging = join(root, 'node_modules/.tmp/mkdist-src')
const outDir = join(root, 'node_modules/.tmp/mkdist-out')

// staging dir with exactly the corpus files
rmSync(staging, { recursive: true, force: true })
for (const f of corpus) {
  const from = join(srcRoot, f.rel)
  const to = join(staging, f.rel)
  cpSync(from, to)
}

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
  console.log(`${name.padEnd(40)} min ${t[0].toFixed(1)}ms  med ${t[t.length >> 1].toFixed(1)}ms`)
}

// sanity: esbuild transform output
const sample = readFileSync(join(srcRoot, 'array/chunk.ts'), 'utf8')
const out = await esbuildTransform(sample, { loader: 'ts', target: 'esnext' })
console.log('esbuild sample ok:', out.code.includes('export function chunk(') && !out.code.includes('readonly T[]'))

await timed('full mkdist() run (fs writes incl.)', async () => {
  const r = await mkdist({ srcDir: staging, distDir: outDir })
  if (r.errors.length > 0) throw new Error('mkdist errors: ' + JSON.stringify(r.errors[0]))
}, 3)

await timed('esbuild.transform ×793 sequential', async () => {
  for (const s of sources) sink += (await esbuildTransform(s, { loader: 'ts', target: 'esnext' })).code.length
}, 5)

await timed('esbuild.transform ×793 concurrent', async () => {
  await Promise.all(sources.map(s => esbuildTransform(s, { loader: 'ts', target: 'esnext' }).then(r => { sink += r.code.length })))
}, 5)

readdirSync(outDir).length && console.log('mkdist outputs written:', readdirSync(outDir).length, 'entries at top level')
