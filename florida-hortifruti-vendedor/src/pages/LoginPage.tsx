import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { mensagemErroLogin } from '../lib/session'
import { useAuth } from '../contexts/useAuth'
import logo from '../assets/logo.png'

export function LoginPage() {
  const { login, usuario } = useAuth()
  const [params] = useSearchParams()
  const redirectRaw = params.get('redirect') || '/'
  const redirect = redirectRaw.startsWith('/') ? redirectRaw : '/'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (usuario) return <Navigate to={redirect} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, senha)
    } catch (err: any) {
      setError(mensagemErroLogin(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="brand-login min-h-screen flex flex-col items-center justify-center px-6">
      <div className="brand-rise mb-8 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-cream p-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
          <img src={logo} alt="Florida Supply" className="h-full w-auto" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Florida Supply</h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-ember">
          Pedidos para vendedores
        </p>
      </div>

      <div className="brand-pop bg-cream-50 w-full max-w-sm rounded-3xl p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-ember text-white font-semibold rounded-xl text-base shadow-[0_10px_30px_-10px_rgba(226,90,22,0.7)] hover:bg-ember-600 active:scale-95 transition disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
