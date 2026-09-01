import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL ?? '/api'

export const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      const atual = `${window.location.pathname}${window.location.search}`
      const destino = atual.startsWith('/login')
        ? '/login'
        : `/login?redirect=${encodeURIComponent(atual)}`
      window.location.href = destino
    }
    return Promise.reject(err)
  },
)
