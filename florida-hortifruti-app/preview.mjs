// Servidor local que imita o Vercel: /<perfil>/... serve o sistema e cai no index.html dele.
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APPS, SITE_ACESSAR_URL } from './apps.mjs'

const dist = fileURLToPath(new URL('./dist', import.meta.url))
const port = Number(process.env.PORT ?? 5190)
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const perfil = APPS.find((a) => caminho === `/${a.perfil}` || caminho.startsWith(`/${a.perfil}/`))
  if (!perfil) {
    res.writeHead(302, { Location: SITE_ACESSAR_URL }).end()
    return
  }
  let arquivo = normalize(join(dist, caminho))
  if (!arquivo.startsWith(dist)) return res.writeHead(400).end()
  if (!existsSync(arquivo) || statSync(arquivo).isDirectory()) arquivo = join(dist, perfil.perfil, 'index.html')
  res.writeHead(200, { 'Content-Type': tipos[extname(arquivo)] ?? 'application/octet-stream' })
  createReadStream(arquivo).pipe(res)
}).listen(port, () => {
  console.log(`Sistemas em http://localhost:${port}`)
  for (const a of APPS) console.log(`  http://localhost:${port}/${a.perfil}`)
})
