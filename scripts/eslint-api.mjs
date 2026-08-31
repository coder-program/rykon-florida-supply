import { spawnSync } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const api = resolve(root, 'florida-hortifruti')
const files = process.argv.slice(2).map((file) => relative(api, resolve(root, file)))

if (files.length === 0) process.exit(0)

const result = spawnSync('npx', ['eslint', '--max-warnings=0', ...files], {
  cwd: api,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
