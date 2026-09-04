import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/useAuth'

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
      setError(
        err?.message === 'Este acesso não é de cliente'
          ? 'Este login não é do app de cliente.'
          : 'E-mail ou senha inválidos.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-green-600 flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-3xl">🍓</span>
        </div>
        <h1 className="text-white font-bold text-xl">Flórida Supply</h1>
        <p className="text-green-200 text-sm mt-1">Pedidos do cliente</p>
      </div>
      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((v) => !v)}
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
            className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          Recebeu um convite?{' '}
          <Link to="/definir-senha" className="text-green-700 font-medium">
            Definir senha
          </Link>
        </p>
      </div>
    </div>
  )
}
