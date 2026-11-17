// Roda um script npm em todos os apps: node scripts/run-all.mjs lint
// Não para no primeiro erro: mostra todos e sai com falha se algum falhou.
import { spawnSync } from 'node:child_process'
import { APPS } from './apps.mjs'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('uso: node scripts/run-all.mjs <script npm> [args]')
  process.exit(2)
}
// "audit" é comando do npm, não script
const comando = args[0] === 'audit' ? args : ['run', ...args]

const falhas = []
for (const app of APPS) {
  console.log(`\n=== ${app}: npm ${comando.join(' ')}`)
  const r = spawnSync('npm', [...comando, '--prefix', app], { stdio: 'inherit', shell: true })
  if (r.status !== 0) falhas.push(app)
}

if (falhas.length) {
  console.error(`\nFalhou em: ${falhas.join(', ')}`)
  process.exit(1)
}
console.log('\nTudo ok')
