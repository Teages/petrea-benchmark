// Regenerates the generated blocks in README.md (environment line + results
// table) from bench-output.txt and corpus.json. Idempotent: running it after
// an unchanged bench run leaves README.md untouched.
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ansi = /\x1b\[[0-9;]*m/g

const corpus = JSON.parse(readFileSync(join(root, 'corpus.json'), 'utf8'))
const bytes = corpus.reduce((n, f) => n + f.bytes, 0)

const txt = readFileSync(join(root, 'bench-output.txt'), 'utf8').replace(ansi, '')
const rows = []
for (const m of txt.matchAll(/^\s+· (.+?)\s{2,}(\d[\d.]*)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+/gm)) {
  rows.push({ name: m[1].trim(), min: +m[3], max: +m[4], mean: +m[5] })
}
if (rows.length === 0) throw new Error('no benchmark rows parsed from bench-output.txt')

const anchor = rows.find(r => r.name === 'oxidase (wasm, published)')
if (!anchor) throw new Error('anchor row "oxidase (wasm, published)" not found')

const expected = [
  'oxidase (native, async, concurrent)',
  'petrea (native, async, concurrent)',
  'oxidase (native)',
  'rolldown (transform, concurrent)',
  'petrea (native, sync)',
  'oxidase (wasm, published)',
  'oxidase (native, async)',
  'petrea (native, async)',
  'petrea (wasm, sync)',
  'rolldown (transformSync)',
  'petrea (wasm, async, concurrent)',
  'ts-blank-space',
  'petrea (wasm, async)',
  'esbuild (concurrent)',
  'esbuild',
]
for (const name of expected) {
  if (!rows.some(r => r.name === name)) throw new Error(`row "${name}" not found in bench-output.txt`)
}
// fastest first — "Speed" is anchor.mean / mean, so this is speed descending
const sorted = [...rows].sort((a, b) => a.mean - b.mean)

const results = [
  '| Transpiler | Total best (ms) | Total slow (ms) | Total avg (ms) | Throughput (MB/s) | Speed (oxidase wasm = 1x) |',
  '|---|---|---|---|---|---|',
  ...sorted.map((r) => {
    return `| ${r.name} | ${r.min.toFixed(2)} | ${r.max.toFixed(2)} | ${r.mean.toFixed(2)} | ${(bytes / (r.mean / 1000) / 1e6).toFixed(1)} | ${(anchor.mean / r.mean).toFixed(2)}x |`
  }),
].join('\n')

let osVersion
if (process.platform === 'darwin') {
  osVersion = `macOS ${execSync('sw_vers -productVersion').toString().trim()}`
} else {
  osVersion = execSync('uname -sr').toString().trim()
}
const cpu = os.cpus()[0].model
const vitest = JSON.parse(readFileSync(join(root, 'node_modules/vitest/package.json'), 'utf8')).version
const environment = `${cpu} · ${osVersion} · Node.js ${process.version} · vitest ${vitest} bench mode.`

const readmePath = join(root, 'README.md')
let readme = readFileSync(readmePath, 'utf8')
for (const [name, content] of [['environment', environment], ['results', results]]) {
  const start = `<!-- generated:${name}:start -->`
  const end = `<!-- generated:${name}:end -->`
  const s = readme.indexOf(start)
  const e = readme.indexOf(end)
  if (s === -1 || e === -1) throw new Error(`markers for ${name} not found in README.md`)
  readme = readme.slice(0, s + start.length) + '\n' + content + '\n' + readme.slice(e)
}
writeFileSync(readmePath, readme)
console.log('README.md generated blocks refreshed')
