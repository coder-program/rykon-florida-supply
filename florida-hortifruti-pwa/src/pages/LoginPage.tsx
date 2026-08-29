import { useState, FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
    try { await login(email, senha) }
    catch { setError('E-mail ou senha inválidos.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-3xl">🍓</span>
        </div>
        <h1 className="text-white font-bold text-xl">Flórida Hortifruti</h1>
        <p className="text-green-200 text-sm mt-1">Pedidos para vendedores</p>
      </div>

      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="seu@email.com" required autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
            <input
              type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••" required autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl text-base hover:bg-green-700 active:scale-95 transition disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
