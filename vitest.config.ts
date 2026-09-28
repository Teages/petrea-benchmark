import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
    // vitest 5's default reporter no longer prints the benchmark table;
    // verbose does (required by scripts/update-readme.mjs).
    reporters: ['verbose'],
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
})
