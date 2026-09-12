// Loads the locally built napi binding of oxidase (source: github.com/branchseer/oxidase
// @ 045ea46, the exact source of the published npm 0.0.3 wasm build).
// The binding crate is applied from patches/oxidase-native.patch; rebuild via
// `npm run build:oxidase-native` (steps in the README).
// `transpile` mirrors upstream's wasm binding; `transpileAsync` is a local
// addition that runs the same transpile on the JS runtime's worker pool.
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function findBinding() {
  const candidates = []
  if (process.platform === 'darwin') {
    candidates.push(`native/oxidase-napi-darwin-${process.arch}.node`)
  } else if (process.platform === 'linux') {
    const arch = process.arch === 'x64' ? 'x64-gnu' : process.arch === 'arm64' ? 'arm64-gnu' : process.arch
    candidates.push(`native/oxidase-napi-linux-${arch}.node`)
  }
  candidates.push('native/oxidase-napi-darwin-arm64.node') // legacy committed artifact
  for (const c of candidates) {
    const p = join(root, c)
    if (existsSync(p)) return p
  }
  throw new Error(`no oxidase native binding found (looked for: ${candidates.join(', ')}). Run \`npm run build:oxidase-native\` first.`)
}

const binding = require(findBinding())

export const transpile = (source, path) => binding.transpile(source, path ?? null)
export const transpileAsync = async (source, path) => binding.transpileAsync(source, path ?? null)
