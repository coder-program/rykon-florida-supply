// Compila os 4 sistemas, cada um na sua pasta: dist/admin, dist/vendedor, dist/motorista, dist/cliente.
// As variáveis VITE_* (ex.: VITE_API_URL) vêm do ambiente e valem para todos.
import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APPS } from './apps.mjs'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '..')
const dist = join(aqui, 'dist')
const instalar = process.env.CI || process.env.VERCEL || !APPS.every((a) => existsSync(join(raiz, a.pasta, 'node_modules')))

rmSync(dist, { recursive: true, force: true })

for (const { perfil, pasta } of APPS) {
  const cwd = join(raiz, pasta)
  const run = (cmd) => execSync(cmd, { cwd, stdio: 'inherit' })
  console.log(`\n▶ ${perfil}  (${pasta})`)
  if (instalar) run('npm ci --include=dev --no-audit --no-fund')
  run(`npx vite build --base=/${perfil}/ --outDir "${join(dist, perfil)}" --emptyOutDir`)
}

console.log(`\n✓ ${APPS.length} sistemas compilados em ${dist}`)
