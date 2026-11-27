import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, MapPin, Package, Truck } from 'lucide-react'
import { api } from '../lib/api'
import { DISPONIBILIDADE, formatDate, STATUS_COLOR, STATUS_LABEL } from '../lib/utils'

type Aba = 'entregas' | 'estoque' | 'pedidos'
const ABAS: { id: Aba; label: string; icon: typeof Truck }[] = [
  { id: 'entregas', label: 'Entregas', icon: Truck },
  { id: 'estoque', label: 'Estoque', icon: Package },
  { id: 'pedidos', label: 'Pedidos', icon: ClipboardList },
]
// Pedido aprovado e ainda não entregue
const EM_ANDAMENTO = ['APROVADO', 'EM_SEPARACAO', 'PRONTO_PARA_ENTREGA', 'EM_ENTREGA']

function Status({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

const numero = (n: number) => `#${String(n).padStart(6, '0')}`

// Painel do cliente: só consulta (entregas, estoque disponível e pedidos), sem nenhuma ação
export function PainelPage() {
  const [aba, setAba] = useState<Aba>('entregas')
  const { data: pedidos = [], isLoading: carregandoPedidos } = useQuery<any[]>({
    queryKey: ['portal-pedidos'],
    queryFn: () => api.get('/portal-cliente/pedidos').then((r) => r.data),
    refetchInterval: 60_000,
  })
  const { data: produtos = [], isLoading: carregandoProdutos } = useQuery<any[]>({
    queryKey: ['portal-produtos'],
    queryFn: () => api.get('/portal-cliente/produtos').then((r) => r.data),
    enabled: aba === 'estoque',
  })

  const entregas = pedidos.filter((p) => EM_ANDAMENTO.includes(p.status))
  const entregues = pedidos.filter((p) => p.status === 'ENTREGUE').slice(0, 10)

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] text-gray-500">A caminho</p>
          <p className="text-xl font-semibold text-gray-900">
            {pedidos.filter((p) => p.status === 'EM_ENTREGA').length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] text-gray-500">Em andamento</p>
          <p className="text-xl font-semibold text-gray-900">{entregas.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] text-gray-500">Aguardando</p>
          <p className="text-xl font-semibold text-gray-900">
            {pedidos.filter((p) => p.status === 'AGUARDANDO_APROVACAO').length}
          </p>
        </div>
      </div>

      <div role="tablist" className="flex gap-1 rounded-2xl bg-gray-100 p-1">
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium ${aba === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {aba === 'entregas' &&
        (carregandoPedidos ? (
          <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {entregas.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">
                Nenhuma entrega em andamento.
              </p>
            )}
            {entregas.map((p) => (
              <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">Pedido {numero(p.numero)}</p>
                  <Status status={p.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {p.itens?.map((i: any) => `${i.quantidade} ${i.nome}`).join(' · ')}
                </p>
                {p.rastreioToken && (
                  <Link
                    to={`/rastreio/${p.rastreioToken}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"
                  >
                    <MapPin className="h-4 w-4" />
                    {p.status === 'EM_ENTREGA' ? 'Ver a rota do motorista' : 'Acompanhar entrega'}
                  </Link>
                )}
              </div>
            ))}
            {entregues.length > 0 && (
              <>
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Entregues recentemente
                </p>
                {entregues.map((p) => (
                  <Link
                    key={p.id}
                    to={`/pedidos/${p.id}`}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm"
                  >
                    <span>
                      {numero(p.numero)}{' '}
                      <span className="text-gray-500">
                        · {formatDate(p.comprovante?.dataHora ?? p.data)}
                      </span>
                    </span>
                    <Status status={p.status} />
                  </Link>
                ))}
              </>
            )}
          </div>
        ))}

      {aba === 'estoque' &&
        (carregandoProdutos ? (
          <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {produtos.length === 0 && (
              <li className="py-6 text-center text-sm text-gray-400">Nenhum produto disponível.</li>
            )}
            {produtos.map((p) => {
              const d = DISPONIBILIDADE[p.disponibilidade] ?? DISPONIBILIDADE.INDISPONIVEL
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{p.nome}</p>
                    {p.quantidadeAproximada != null && (
                      <p className="text-xs text-gray-500">
                        ~{Math.max(0, Math.round(p.quantidadeAproximada))} {p.unidadeVenda}
                      </p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
                    <span className={`h-2 w-2 rounded-full ${d.className}`} />
                    {d.label}
                  </span>
                </li>
              )
            })}
          </ul>
        ))}

      {aba === 'pedidos' &&
        (carregandoPedidos ? (
          <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>
        ) : (
          <ul className="space-y-2">
            {pedidos.length === 0 && (
              <li className="py-6 text-center text-sm text-gray-400">Nenhum pedido ainda.</li>
            )}
            {pedidos.slice(0, 30).map((p) => (
              <li key={p.id}>
                <Link
                  to={`/pedidos/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-semibold text-gray-900">{numero(p.numero)}</span>
                    <span className="text-gray-500"> · {formatDate(p.data)}</span>
                  </span>
                  <Status status={p.status} />
                </Link>
              </li>
            ))}
            {pedidos.length > 30 && (
              <li className="pt-1 text-center">
                <Link to="/pedidos" className="text-sm font-semibold text-emerald-700">
                  Ver todos os pedidos
                </Link>
              </li>
            )}
          </ul>
        ))}
    </div>
  )
}
