import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Telas inteiras no jsdom demoram em máquina lenta
    testTimeout: 60_000,
    // Threads sobem mais rápido que processos: o limite de 60 s para iniciar estoura com a máquina cheia
    pool: 'threads',
    // Cada worker carrega um jsdom com o painel inteiro: muitos ao mesmo tempo esgotam a memória
    maxWorkers: 2,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx só monta o app no navegador
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
})
