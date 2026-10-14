import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
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
      setError(
        err?.message === 'Este acesso não é de motorista'
          ? 'Este login não é do app de entregas.'
          : 'E-mail ou senha inválidos.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="brand-login min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="brand-rise mb-8 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-cream p-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
          <img src={logo} alt="Florida Supply" className="h-full w-auto" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Florida Supply</h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-ember">Entregas do motorista</p>
      </div>
      <form onSubmit={handleSubmit} className="brand-pop bg-cream-50 w-full max-w-sm rounded-3xl p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="w-full px-4 py-3 border border-gray-300 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          className="w-full px-4 py-3 border border-gray-300 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          required
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-ember text-white font-semibold rounded-xl shadow-[0_10px_30px_-10px_rgba(226,90,22,0.7)] hover:bg-ember-600 active:scale-95 transition disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
