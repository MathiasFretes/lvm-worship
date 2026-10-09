import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/lib/keyref/__tests__/**/*.test.ts',
      'src/lib/tuner/__tests__/**/*.test.ts',
      'src/lib/metronome/__tests__/**/*.test.ts',
      'src/lib/__tests__/{capo,tapTempo}.test.ts',
    ],
  },
})
