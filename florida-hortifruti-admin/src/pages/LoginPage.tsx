import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Input } from '../components/ui/Input'
import { mensagemErroLogin } from '../lib/session'
import { useAuth } from '../contexts/useAuth'
import logo from '../assets/logo.png'

export function LoginPage() {
  const { login, usuario } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (usuario) return <Navigate to="/" replace />

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
    <div className="brand-login min-h-screen flex items-center justify-center p-4">
      <div className="brand-pop bg-cream-50 rounded-3xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center p-2 shadow-sm">
            <img src={logo} alt="Florida Supply" className="h-full w-auto" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">Florida Supply</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
              Painel administrativo
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="seu@email.com"
              required
            />
          </div>
          <Input
            label="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-sm font-semibold bg-ember text-white rounded-xl shadow-[0_10px_30px_-10px_rgba(226,90,22,0.7)] hover:bg-ember-600 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
