import { execSync } from 'node:child_process'
import { APPS } from './apps.mjs'

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

// Só os apps com arquivo no commit: typecheck e testes
for (const dir of APPS.filter((app) => staged.some((file) => file.startsWith(`${app}/`)))) {
  execSync(`npm run typecheck --prefix ${dir}`, { stdio: 'inherit' })
  execSync(`npm test --prefix ${dir}`, { stdio: 'inherit' })
}
