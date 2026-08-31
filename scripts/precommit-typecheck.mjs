import { execSync } from 'node:child_process'

const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const packages = []
if (staged.some((file) => file.startsWith('florida-hortifruti-pwa/'))) {
  packages.push('florida-hortifruti-pwa')
}
if (staged.some((file) => file.startsWith('florida-hortifruti-admin/'))) {
  packages.push('florida-hortifruti-admin')
}
if (staged.some((file) => file.startsWith('florida-hortifruti/'))) {
  packages.push('florida-hortifruti')
}

if (packages.length === 0) process.exit(0)

for (const dir of packages) {
  execSync(`npm run typecheck --prefix ${dir}`, { stdio: 'inherit' })
}
