import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'

// Destino do QR da etiqueta para quem está no painel: abre o pedido na tela de Pedidos
export function AbrirPedidoPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelado = false
    api
      .get(`/p/${token}`)
      .then((r) => {
        if (cancelado) return
        if (!r.data?.pedidoId) {
          setErro('Pedido não encontrado.')
          return
        }
        navigate(`/pedidos?pedido=${encodeURIComponent(r.data.pedidoId)}`, { replace: true })
      })
      .catch(() => {
        if (!cancelado) setErro('Não foi possível abrir o pedido desta etiqueta.')
      })
    return () => {
      cancelado = true
    }
  }, [token, navigate])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6">
      {erro ? (
        <>
          <p className="text-center text-sm text-red-600">{erro}</p>
          <button
            type="button"
            onClick={() => navigate('/pedidos')}
            className="text-sm font-medium text-green-700"
          >
            Ir para Pedidos
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
