// Os 4 sistemas podem rodar no mesmo domínio (app.floridahortifruti.com.br/<perfil>),
// então o login de cada um fica guardado com um nome próprio.
const PREFIXO = 'fh-motorista'
export const TOKEN_KEY = `${PREFIXO}:token`
export const USUARIO_KEY = `${PREFIXO}:usuario`

/** Pasta onde o sistema foi publicado ('/' ou, por exemplo, '/motorista') */
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

// Perfis que podem entrar neste app. A API confere o mesmo no login (src/auth/apps-acesso.ts);
// motorista, vendedor, cliente etc. nunca entram pelo app de outro perfil.
export const APP = 'motorista'
export const PAPEIS_DO_APP: string[] = ['MOTORISTA']
export const MENSAGEM_APP_ERRADO = 'Este usuário não tem acesso a este app.'

/** Usuário salvo só vale se o perfil for deste app; senão a sessão é descartada */
export function usuarioSalvo<T extends { papel: string }>(): T | null {
  let usuario: T | null = null
  try {
    const raw = localStorage.getItem(USUARIO_KEY)
    usuario = raw ? (JSON.parse(raw) as T) : null
  } catch {
    usuario = null
  }
  if (usuario && PAPEIS_DO_APP.includes(usuario.papel)) return usuario
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USUARIO_KEY)
  return null
}

/** Texto do erro de login: app errado (403 da API ou checagem local) ou senha inválida */
export function mensagemErroLogin(err: any) {
  if (err?.response?.status === 403) return err.response.data?.message ?? MENSAGEM_APP_ERRADO
  if (err?.message === MENSAGEM_APP_ERRADO) return MENSAGEM_APP_ERRADO
  return 'E-mail ou senha inválidos.'
}
