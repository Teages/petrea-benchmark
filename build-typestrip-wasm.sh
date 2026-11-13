#!/bin/sh
# Builds typestrip's erase-mode wasm engine (native/typestrip-erase.wasm) from
# pinned sources: the engine is Zena (a WasmGC language) compiled by zena-cli,
# which is itself built from elematic/zena. The typestrip JS wrapper comes from
# the vendor/typestrip submodule; only the wasm needs this build.
# Idempotent: the zena checkout/cargo build and the engine rebuild are skipped
# or overwritten safely.
set -eu
cd "$(dirname "$0")"
ROOT="$(pwd)"

# zena-cli commit typestrip's CONTRIBUTING.md pins; a different one may emit a
# different binary. Pinned here rather than tracked as a submodule: the repo is
# ~150 MB of history (packages/website et al.), too heavy to vendor.
ZENA_REPO=https://github.com/elematic/zena
ZENA_COMMIT=a7c1d2cd0cc87f72a3b948151897ce7176f51def

# zena needs Node.js 25+ to build (its npm scripts / wireit pipeline).
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 25 ]; then
  echo "build-typestrip-wasm: Node.js >= 25 required to build zena (found $(node --version))." >&2
  echo "  e.g. `fnm use 25`, then rerun." >&2
  exit 1
fi

git submodule update --init --depth 1 vendor/typestrip

WORK="$ROOT/.build/zena"
if [ "$(git -C "$WORK" rev-parse HEAD 2>/dev/null || true)" != "$ZENA_COMMIT" ]; then
  echo "==> cloning $ZENA_REPO @ $ZENA_COMMIT (shallow) into .build/zena"
  rm -rf "$WORK"
  mkdir -p "$WORK"
  git -C "$WORK" init -q
  git -C "$WORK" remote add origin "$ZENA_REPO"
  git -C "$WORK" fetch -q --depth 1 origin "$ZENA_COMMIT"
  git -C "$WORK" checkout -q FETCH_HEAD
fi

if [ ! -d "$WORK/node_modules" ]; then
  echo "==> npm ci (zena)"
  (cd "$WORK" && npm ci --no-fund --no-audit)
fi

if [ ! -x "$WORK/target/release/zena-cli" ]; then
  echo "==> cargo build --release (zena-cli; a few minutes)"
  (cd "$WORK" && cargo build --release)
fi

# wireit decides freshness itself; warm runs are a cache hit.
echo "==> npm run build (zena self-hosted compiler)"
(cd "$WORK" && npm run build --silent)

# binaryen (wasm-opt/wasm-as/wasm-merge) at the version typestrip pins, installed
# into the submodule checkout (gitignored there).
BINARYEN_VERSION="$(node -p 'JSON.parse(require("fs").readFileSync("vendor/typestrip/package.json","utf8")).devDependencies.binaryen')"
if [ ! -x "$ROOT/vendor/typestrip/node_modules/.bin/wasm-opt" ]; then
  echo "==> npm install binaryen@$BINARYEN_VERSION (into vendor/typestrip)"
  (cd "$ROOT/vendor/typestrip" && npm install --no-save --no-fund --no-audit "binaryen@$BINARYEN_VERSION")
fi

echo "==> building typestrip engines"
(cd "$ROOT/vendor/typestrip" && ZENA="$WORK/target/release/zena-cli" sh scripts/build.sh)

mkdir -p native
cp "$ROOT/vendor/typestrip/build/erase.wasm" "$ROOT/native/typestrip-erase.wasm"
echo "==> built native/typestrip-erase.wasm"
