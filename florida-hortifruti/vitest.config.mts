import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    // Decorators do Nest/class-validator leem metadados (no app, o Nest carrega isso no boot)
    setupFiles: ['reflect-metadata'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      // main.ts só sobe o servidor; o resto do código conta
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/test-utils/**'],
      reporter: ['text-summary', 'html'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
