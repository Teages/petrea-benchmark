// Builds the benchmark corpus from the es-toolkit submodule.
// A file is included only if all three transpilers accept it in strict mode
// (explicit throwing onError / default throwing behavior) and preserve the
// input length — no directory-level exclusions beyond test/declaration files.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = new URL('.', import.meta.url).pathname
const srcDir = join(root, 'vendor/es-toolkit/src')

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) out.push(...walk(p))
    else if (name.isFile()) out.push(p)
  }
  return out
}

const all = walk(srcDir).filter(p => p.endsWith('.ts'))
const skipped = []
const candidates = all.filter((p) => {
  const rel = relative(srcDir, p)
  if (rel.endsWith('.test.ts') || rel.endsWith('.spec.ts') || rel.endsWith('.d.ts')) {
    skipped.push({ rel, reason: 'test/declaration file' })
    return false
  }
  return true
})

const { transpileSync: petreaSync } = await import(pathToFileURL(join(root, 'node_modules/petrea/dist/index.mjs')))
const { transpile: oxidaseTranspile } = await import('oxidase')
const tsBlankSpace = (await import('ts-blank-space')).default

const onUnsupported = () => {
  throw new Error('unsupported TypeScript syntax (runtime TS construct)')
}
const tools = {
  'petrea': s => petreaSync(s, { onError: onUnsupported }),
  'oxidase': s => oxidaseTranspile(s),
  'ts-blank-space': s => tsBlankSpace(s, onUnsupported),
}

const corpus = []
const excluded = []
let bytes = 0
for (const p of candidates) {
  const rel = relative(srcDir, p)
  const source = readFileSync(p, 'utf8')
  const failures = []
  for (const [name, fn] of Object.entries(tools)) {
    try {
      const out = fn(source)
      if (out.length !== source.length) failures.push(`${name}: output length ${out.length} != input ${source.length}`)
    } catch (err) {
      failures.push(`${name}: ${String(err.message).split('\n')[0]}`)
    }
  }
  if (failures.length > 0) excluded.push({ rel, reason: failures.join(' | ') })
  else {
    corpus.push({ rel, bytes: Buffer.byteLength(source) })
    bytes += Buffer.byteLength(source)
  }
}

writeFileSync(join(root, 'corpus.json'), JSON.stringify(corpus, null, 2))
writeFileSync(join(root, 'corpus-excluded.json'), JSON.stringify({ skipped, excluded }, null, 2))

console.log(`corpus: ${corpus.length} files, ${(bytes / 1e6).toFixed(2)} MB`)
console.log(`skipped (test/declaration): ${skipped.length}`)
if (excluded.length > 0) {
  console.log(`excluded (tool failures): ${excluded.length}`)
  for (const e of excluded) console.log(`  - ${e.rel}: ${e.reason}`)
}
