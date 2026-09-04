module.exports = {
  'florida-hortifruti-pwa/**/*.{ts,tsx,css,json}': 'prettier --write',
  'florida-hortifruti-pwa/**/*.{ts,tsx}': () => 'npm run lint --prefix florida-hortifruti-pwa',
  'florida-hortifruti-pwa-cliente/**/*.{ts,tsx,css,json}': 'prettier --write',
  'florida-hortifruti-pwa-cliente/**/*.{ts,tsx}': () =>
    'npm run lint --prefix florida-hortifruti-pwa-cliente',
  'florida-hortifruti-pwa-motorista/**/*.{ts,tsx,css,json}': 'prettier --write',
  'florida-hortifruti-pwa-motorista/**/*.{ts,tsx}': () =>
    'npm run lint --prefix florida-hortifruti-pwa-motorista',
  'florida-hortifruti-admin/**/*.{ts,tsx,css,json}': 'prettier --write',
  'florida-hortifruti-admin/**/*.{ts,tsx}': () => 'npm run lint --prefix florida-hortifruti-admin',
  'florida-hortifruti/{src,prisma}/**/*.{ts,js,cjs,json}': 'prettier --write',
  'florida-hortifruti/{src,prisma}/**/*.ts': (files) =>
    `node scripts/eslint-api.mjs ${files.map((file) => `"${file.replace(/\\/g, '/')}"`).join(' ')}`,
}
