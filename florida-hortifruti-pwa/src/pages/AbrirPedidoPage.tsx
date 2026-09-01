import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/useAuth'

export function AbrirPedidoPage() {
  const { token } = useParams<{ token: string }>()
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!token || !usuario) return

    let cancelado = false

    async function abrir() {
      try {
        const publico = await api.get(`/p/${token}`).then((r) => r.data)
        if (cancelado) return
        if (!publico?.pedidoId) {
          setErro('Pedido não encontrado.')
          return
        }
        await api.get(`/pedidos/${publico.pedidoId}`)
        if (cancelado) return
        navigate(`/pedido/${publico.pedidoId}`, { replace: true })
      } catch (e: any) {
        if (cancelado) return
        const status = e?.response?.status
        if (status === 403) setErro('Você não tem acesso a este pedido.')
        else if (status === 404) setErro('Pedido não encontrado.')
        else setErro('Não foi possível abrir o pedido.')
      }
    }

    void abrir()
    return () => {
      cancelado = true
    }
  }, [token, usuario, navigate])

  if (!token) return <Navigate to="/" replace />

  if (!usuario) {
    return (
      <Navigate to={`/login?redirect=${encodeURIComponent(`/abrir-pedido/${token}`)}`} replace />
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-6">
      {erro ? (
        <>
          <p className="text-center text-sm text-red-600">{erro}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-medium text-green-700"
          >
            Voltar
          </button>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Abrindo o pedido...</p>
        </>
      )}
    </div>
  )
}
