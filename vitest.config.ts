import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
})
