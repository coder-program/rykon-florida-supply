// Sobe a API (dist/) num banco de teste, roda test/e2e.cjs e derruba a API.
// Antes: npm run build. Banco: um Postgres descartável, ex.:
//   docker run -d --name florida-teste -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=florida_teste -p 127.0.0.1:55999:5432 postgres:16
//   DATABASE_URL=postgresql://postgres:teste@127.0.0.1:55999/florida_teste npm run test:e2e
import { execSync, spawn } from 'node:child_process'

const PORT = process.env.E2E_PORT ?? '3999'
const env = {
  ...process.env,
  PORT,
  JWT_SECRET: process.env.JWT_SECRET ?? 'segredo-de-teste',
  E2E_API_URL: `http://127.0.0.1:${PORT}`,
}

execSync('npx prisma migrate deploy', { stdio: 'inherit', env })

const api = spawn(process.execPath, ['dist/main'], { env, stdio: ['ignore', 'pipe', 'inherit'] })
let log = ''
api.stdout.on('data', (d) => (log = (log + d).slice(-4000)))
let codigo = 1
try {
  const limite = Date.now() + 180_000
  for (;;) {
    if (api.exitCode !== null) throw new Error(`API caiu ao subir:\n${log}`)
    try {
      await fetch(`${env.E2E_API_URL}/health`)
      break
    } catch {
      if (Date.now() > limite) throw new Error(`API não subiu em 180s:\n${log}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  try {
    execSync(`node test/e2e.cjs`, { stdio: 'inherit', env })
    codigo = 0
  } catch {
    codigo = 1
  }
} finally {
  api.kill()
}
process.exit(codigo)
