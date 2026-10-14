import axios from 'axios'
import { TOKEN_KEY, USUARIO_KEY, appUrl, caminhoAtual } from './session'

const baseURL = import.meta.env.VITE_API_URL ?? '/api'
const isAbsoluteBaseUrl = /^https?:\/\//i.test(baseURL)
const apiOrigin = isAbsoluteBaseUrl ? new URL(baseURL).origin : ''

export const api = axios.create({ baseURL })

export function resolveAssetUrl(path: string | null | undefined) {
  if (!path) return ''
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (isAbsoluteBaseUrl) {
    return `${apiOrigin}${normalizedPath}`
  }

  return normalizedPath
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USUARIO_KEY)
      const atual = caminhoAtual()
      const destino = atual.startsWith('/login')
        ? '/login'
        : `/login?redirect=${encodeURIComponent(atual)}`
      window.location.href = appUrl(destino)
    }
    return Promise.reject(err)
  },
)
