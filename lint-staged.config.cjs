// Front-ends (Vite + React): mesmo padrão em todos
const FRONTS = [
  'florida-hortifruti-admin',
  'florida-hortifruti-vendedor',
  'florida-hortifruti-cliente',
  'florida-hortifruti-motorista',
  'florida-hortifruti-site',
]

const config = {
  'florida-hortifruti/{src,prisma,test}/**/*.{ts,js,cjs,json}': 'prettier --write',
  'florida-hortifruti/{src,prisma,test}/**/*.ts': (files) =>
    `node scripts/eslint-api.mjs ${files.map((file) => `"${file.replace(/\\/g, '/')}"`).join(' ')}`,
}

for (const app of FRONTS) {
  config[`${app}/src/**/*.{ts,tsx,css,json}`] = 'prettier --write'
  config[`${app}/src/**/*.{ts,tsx}`] = () => `npm run lint --prefix ${app}`
}

module.exports = config
