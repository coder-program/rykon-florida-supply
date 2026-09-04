import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

export function DefinirSenhaPage() {
  const [params] = useSearchParams()
  const [token, setToken] = useState(params.get('token') ?? '')
  const [senha, setSenha] = useState('')
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      await api.post('/auth/definir-senha', { token, senha })
      setOk(true)
    } catch (err: any) {
      const msg = err?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível definir a senha.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-green-600 flex flex-col items-center justify-center px-6">
      <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Definir senha</h1>
        <p className="text-sm text-gray-500 mb-4">Crie a senha do seu acesso ao app.</p>
        {ok ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700">Senha definida. Você já pode entrar.</p>
            <Link
              to="/login"
              className="block w-full py-3 text-center bg-green-600 text-white rounded-xl font-medium"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {!params.get('token') && (
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                placeholder="Cole o código do convite"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            )}
            <input
              type="password"
              minLength={6}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl"
              placeholder="Nova senha (mín. 6)"
            />
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl disabled:opacity-60"
            >
              {loading ? 'Salvando...' : 'Salvar senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
