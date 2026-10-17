import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { ativarPush, estadoPush, type EstadoPush } from '../lib/push'

// Convite para receber no celular o aviso "pedido a caminho".
// Some quando já está ativado ou quando o aparelho não tem como receber.
export function AtivarNotificacoes() {
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [ativando, setAtivando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    estadoPush()
      .then(setEstado)
      .catch(() => setEstado('indisponivel'))
  }, [])

  if (!estado || estado === 'ativado' || estado === 'indisponivel') return null

  const ativar = async () => {
    setAtivando(true)
    setErro('')
    try {
      setEstado(await ativarPush())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ativar as notificações')
    } finally {
      setAtivando(false)
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Saiba quando o pedido sair para entrega</p>
          {estado === 'desativado' && (
            <>
              <p className="mt-1 text-sm text-gray-600">
                Ative as notificações e avisamos no seu celular assim que o motorista sair.
              </p>
              <button
                type="button"
                onClick={ativar}
                disabled={ativando}
                className="mt-3 min-h-11 cursor-pointer rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {ativando ? 'Ativando...' : 'Ativar notificações'}
              </button>
            </>
          )}
          {estado === 'instalar-ios' && (
            <p className="mt-1 text-sm text-gray-600">
              No iPhone, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra o app
              por lá para ativar as notificações.
            </p>
          )}
          {estado === 'bloqueado' && (
            <p className="mt-1 text-sm text-gray-600">
              As notificações estão bloqueadas. Libere nas configurações do navegador para este
              site. Os avisos continuam aparecendo no sininho.
            </p>
          )}
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        </div>
      </div>
    </section>
  )
}
