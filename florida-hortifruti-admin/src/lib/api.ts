import axios from 'axios'
import { TOKEN_KEY, USUARIO_KEY, appUrl } from './session'

// Em dev usa o proxy Vite (/api). Em produção usa a URL do Render via env.
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
    const isLogin = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USUARIO_KEY)
      window.location.href = appUrl('/login')
    }
    return Promise.reject(err)
  },
)
