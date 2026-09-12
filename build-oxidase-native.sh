#!/bin/sh
# Builds the native napi binding of oxidase from the pinned submodule source.
# Idempotent: applying the patch and rebuilding are skipped/overwritten safely.
set -eu
cd "$(dirname "$0")"
ROOT="$(pwd)"

git submodule update --init --depth 1 vendor/oxidase

if [ ! -f vendor/oxidase/packages/native/bindings/Cargo.toml ]; then
  echo "==> applying patches/oxidase-native.patch"
  git -C vendor/oxidase apply "$ROOT/patches/oxidase-native.patch"
fi

echo "==> cargo build -p oxidase-napi --release"
(cd vendor/oxidase && cargo build -p oxidase-napi --release)

# map this machine to the napi-style binding name bench/oxidase-native.mjs loads
case "$(uname -s)/$(uname -m)" in
  Darwin/arm64)   LIB=liboxidase_napi.dylib; OUT=oxidase-napi-darwin-arm64.node ;;
  Darwin/x86_64)  LIB=liboxidase_napi.dylib; OUT=oxidase-napi-darwin-x64.node ;;
  Linux/x86_64)   LIB=liboxidase_napi.so;    OUT=oxidase-napi-linux-x64-gnu.node ;;
  Linux/aarch64)  LIB=liboxidase_napi.so;    OUT=oxidase-napi-linux-arm64-gnu.node ;;
  *) echo "unsupported platform $(uname -s)/$(uname -m)"; exit 1 ;;
esac

mkdir -p native
cp "vendor/oxidase/target/release/$LIB" "native/$OUT"
echo "==> built native/$OUT"
