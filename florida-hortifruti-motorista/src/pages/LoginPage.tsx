import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'

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
    <div className="min-h-dvh bg-green-600 flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-3xl">🚚</span>
        </div>
        <h1 className="text-white font-bold text-xl">Flórida Supply</h1>
        <p className="text-green-200 text-sm mt-1">Entregas do motorista</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="w-full px-4 py-3 border rounded-xl"
          required
        />
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          className="w-full px-4 py-3 border rounded-xl"
          required
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
