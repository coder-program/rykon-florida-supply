// Os 4 sistemas podem rodar no mesmo domínio (app.floridahortifruti.com.br/<perfil>),
// então o login de cada um fica guardado com um nome próprio.
const PREFIXO = 'fh-admin'
export const TOKEN_KEY = `${PREFIXO}:token`
export const USUARIO_KEY = `${PREFIXO}:usuario`

/** Pasta onde o sistema foi publicado ('/' ou, por exemplo, '/admin') */
export const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

/** URL absoluta de uma rota do sistema, respeitando a pasta de publicação */
export function appUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

/** Rota atual relativa à pasta de publicação (ex.: '/pedido/123') */
export function caminhoAtual() {
  const base = ROUTER_BASENAME === '/' ? '' : ROUTER_BASENAME
  const { pathname, search } = window.location
  const rota = pathname.startsWith(base) ? pathname.slice(base.length) : pathname
  return `${rota || '/'}${search}`
}
