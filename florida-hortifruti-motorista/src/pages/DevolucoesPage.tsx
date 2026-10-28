import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, Search, XCircle } from 'lucide-react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { api, resolveAssetUrl } from '../lib/api'
import { MotivosDevolucao } from '../components/MotivosDevolucao'
import { SELECAO_VAZIA, erroSelecao, type SelecaoMotivos } from '../lib/motivosDevolucao'

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Falha ao ler imagem'))
    reader.readAsDataURL(file)
  })
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONCLUIDA: 'Concluída',
  NEGADA: 'Negada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  NEGADA: 'bg-red-100 text-red-700',
}

type PedidoDevolucao = {
  pedidoId: string
  pedidoNumero: number
  cliente: string | null
  entregueEm: string | null
  etiquetaToken: string | null
  itens: { produtoId: string; nome: string; quantidade: number }[]
}

function numeroPedido(numero: number | null | undefined) {
  return String(numero ?? '').padStart(6, '0')
}

function mensagemErro(e: any, padrao: string) {
  const msg = e?.response?.data?.message
  return Array.isArray(msg) ? msg.join(' ') : msg || e?.message || padrao
}

export function DevolucoesPage() {
  const qc = useQueryClient()
  const scannerRef = useRef<BrowserQRCodeReader | null>(null)
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [busca, setBusca] = useState('')
  const [etiquetaToken, setEtiquetaToken] = useState('')
  const [pedido, setPedido] = useState<PedidoDevolucao | null>(null)
  const [quantidades, setQuantidades] = useState<Record<string, string>>({})
  const [motivosPorItem, setMotivosPorItem] = useState<Record<string, SelecaoMotivos>>({})
  const [mesmoMotivo, setMesmoMotivo] = useState(false)
  const [motivoGeral, setMotivoGeral] = useState<SelecaoMotivos>(SELECAO_VAZIA)
  const [observacao, setObservacao] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [erro, setErro] = useState('')
  const [mostrarSucesso, setMostrarSucesso] = useState(false)
  const [scannerAberto, setScannerAberto] = useState(false)
  const [devolucaoSelecionada, setDevolucaoSelecionada] = useState<any | null>(null)

  const { data: pedidos = [], isLoading: carregandoPedidos } = useQuery({
    queryKey: ['pedidos-para-devolucao'],
    queryFn: () =>
      api
        .get('/devolucoes/pedidos')
        .then((r) => (Array.isArray(r.data) ? (r.data as PedidoDevolucao[]) : [])),
  })

  const { data: devolucoes = [], isLoading } = useQuery({
    queryKey: ['minhas-devolucoes'],
    queryFn: () => api.get('/devolucoes/minhas').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return pedidos
    return pedidos.filter(
      (p) =>
        numeroPedido(p.pedidoNumero).includes(termo) ||
        String(p.cliente ?? '')
          .toLowerCase()
          .includes(termo),
    )
  }, [pedidos, busca])

  // Com um item só não há o que separar: o seletor geral vale para ele
  const usarMotivoGeral = mesmoMotivo || pedido?.itens.length === 1

  const itensComQuantidade = useMemo(
    () => (pedido?.itens ?? []).filter((item) => Number(quantidades[item.produtoId] || 0) > 0),
    [pedido, quantidades],
  )

  function limparFormulario() {
    setPedido(null)
    setEtiquetaToken('')
    setQuantidades({})
    setMotivosPorItem({})
    setMesmoMotivo(false)
    setMotivoGeral(SELECAO_VAZIA)
    setObservacao('')
    setArquivos([])
  }

  const criar = useMutation({
    mutationFn: async () => {
      if (!pedido) throw new Error('Selecione o pedido da devolução')
      if (itensComQuantidade.length === 0) throw new Error('Informe ao menos um item devolvido')

      for (const item of itensComQuantidade) {
        const problema = erroSelecao(
          usarMotivoGeral ? motivoGeral : motivosPorItem[item.produtoId],
          item.nome,
        )
        if (problema) throw new Error(problema)
      }
      if (arquivos.length !== 3) throw new Error('Envie exatamente 3 fotos')

      const fotos = await Promise.all(arquivos.map((file) => toDataUrl(file)))
      const itens = itensComQuantidade.map((item) => {
        const selecao = usarMotivoGeral ? motivoGeral : motivosPorItem[item.produtoId]
        return {
          produtoId: item.produtoId,
          quantidade: Number(quantidades[item.produtoId]),
          motivos: selecao.motivos,
          motivoOutro: selecao.motivos.includes('OUTROS') ? selecao.motivoOutro.trim() : undefined,
        }
      })

      return api.post('/devolucoes', {
        pedidoId: pedido.pedidoId,
        itens,
        observacao: observacao.trim() || undefined,
        fotos,
      })
    },
    onSuccess: () => {
      limparFormulario()
      setErro('')
      setMostrarSucesso(true)
      qc.invalidateQueries({ queryKey: ['minhas-devolucoes'] })
      qc.invalidateQueries({ queryKey: ['devolucoes-resumo-home'] })
    },
    onError: (e: any) => {
      setErro(mensagemErro(e, 'Não foi possível registrar a devolução'))
    },
  })

  const podeEnviar = !criar.isPending && !!pedido && arquivos.length === 3

  async function onSelecionarArquivos(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    if (list.length !== 3) {
      setErro('Selecione exatamente 3 fotos da caixa devolvida')
      setArquivos([])
      return
    }

    setErro('')
    setArquivos(list)
  }

  function escolherPedido(selecionado: PedidoDevolucao) {
    setPedido(selecionado)
    setEtiquetaToken(selecionado.etiquetaToken ?? '')
    setQuantidades({})
    setMotivosPorItem({})
    setErro('')
  }

  async function buscarPedidoPelaEtiqueta(tokenInformado = etiquetaToken) {
    const token = tokenInformado.trim()
    if (!token) return
    try {
      const data = await api
        .get(`/devolucoes/etiqueta/${encodeURIComponent(token)}`)
        .then((r) => r.data as PedidoDevolucao)
      escolherPedido(data)
    } catch (e: any) {
      setErro(mensagemErro(e, 'Etiqueta não encontrada'))
      setPedido(null)
    }
  }

  function alterarQuantidadeDevolvida(produtoId: string, valor: string, maximo: number) {
    const numero = Number(valor || 0)
    if (numero < 0) return
    if (numero > maximo) {
      setErro('A quantidade devolvida não pode ser maior que a quantidade do pedido')
      return
    }
    setErro('')
    setQuantidades((atual) => ({ ...atual, [produtoId]: valor }))
  }

  function pararScanner() {
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (!scannerAberto) {
      pararScanner()
      return
    }

    const video = videoRef.current
    if (!video) return

    setErro('')
    const reader = new BrowserQRCodeReader()
    scannerRef.current = reader

    void reader
      .decodeFromVideoDevice(undefined, video, (result, error) => {
        if (result) {
          const textoLido = result.getText().trim()
          if (textoLido) {
            setEtiquetaToken(textoLido)
            setScannerAberto(false)
            void buscarPedidoPelaEtiqueta(textoLido)
          }
          return
        }

        if (error && (error as Error).name !== 'NotFoundException') {
          setErro('Não foi possível ler o QR. Tente aproximar melhor a câmera.')
        }
      })
      .then((controls) => {
        scannerControlsRef.current = controls
      })
      .catch(() => {
        setErro('Não foi possível abrir a câmera. Verifique a permissão no navegador.')
        setScannerAberto(false)
      })

    return () => {
      pararScanner()
      scannerRef.current = null
    }
  }, [scannerAberto])

  useEffect(() => {
    return () => {
      pararScanner()
    }
  }, [])

  useEffect(() => {
    if (!mostrarSucesso) return

    const timeout = window.setTimeout(() => {
      setMostrarSucesso(false)
    }, 2500)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [mostrarSucesso])

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-gray-50 px-4 py-4">
      {mostrarSucesso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              Devolução registrada com sucesso
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              A devolução foi enviada e ficará visível na lista Minhas devoluções.
            </p>
            <button
              type="button"
              onClick={() => setMostrarSucesso(false)}
              className="mt-4 h-10 w-full cursor-pointer rounded-lg bg-emerald-600 text-sm font-semibold text-white"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      <Link
        to="/"
        className="mb-4 inline-flex cursor-pointer items-center gap-1 text-sm text-gray-600"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="text-lg font-semibold text-gray-900">Devolução</h1>
      <p className="mt-1 text-xs text-gray-500">
        Escolha o pedido entregue (ou escaneie o QR da caixa), informe os itens, os motivos e envie
        3 fotos do produto devolvido.
      </p>

      <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-white p-4">
        {!pedido ? (
          <>
            <div>
              <p className="text-xs font-medium text-gray-700">Pedidos entregues</p>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por número ou cliente"
                  className="h-10 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-red-400"
                />
              </div>
              <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                {carregandoPedidos && (
                  <p className="brand-loading py-3 text-center text-xs text-gray-500">
                    Carregando...
                  </p>
                )}
                {!carregandoPedidos && pedidosFiltrados.length === 0 && (
                  <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
                    {busca ? 'Nenhum pedido encontrado.' : 'Nenhum pedido entregue ainda.'}
                  </p>
                )}
                {pedidosFiltrados.map((p) => (
                  <button
                    key={p.pedidoId}
                    type="button"
                    onClick={() => escolherPedido(p)}
                    className="w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-left transition hover:border-red-300 hover:bg-red-50/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        #{numeroPedido(p.pedidoNumero)}
                      </span>
                      {p.entregueEm && (
                        <span className="text-[11px] text-gray-500">
                          Entregue {new Date(p.entregueEm).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-600">{p.cliente ?? 'Cliente'}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <span className="text-xs font-medium text-gray-700">
                Ou pelo QR da etiqueta (scan/manual)
              </span>
              <div className="mt-1 flex gap-2">
                <input
                  value={etiquetaToken}
                  onChange={(e) => setEtiquetaToken(e.target.value)}
                  placeholder="Ex.: URL do QR ou token"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-400"
                />
                <button
                  type="button"
                  onClick={() => buscarPedidoPelaEtiqueta()}
                  className="h-10 cursor-pointer rounded-lg border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-700"
                >
                  Buscar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setScannerAberto((v) => !v)}
                className="mt-2 h-10 w-full cursor-pointer rounded-lg border border-red-300 bg-white text-sm font-semibold text-red-700"
              >
                {scannerAberto ? 'Fechar câmera' : 'Escanear com câmera'}
              </button>
              {scannerAberto && (
                <div className="mt-2 overflow-hidden rounded-lg border border-red-200 bg-black">
                  <video
                    ref={videoRef}
                    className="h-56 w-full object-cover"
                    muted
                    playsInline
                    autoPlay
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800">
                Pedido #{numeroPedido(pedido.pedidoNumero)}
              </p>
              <p className="truncate text-xs text-red-700">{pedido.cliente ?? 'Cliente'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPedido(null)
                setEtiquetaToken('')
              }}
              className="shrink-0 cursor-pointer rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700"
            >
              Trocar
            </button>
          </div>
        )}

        {pedido && pedido.itens.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">Itens devolvidos (parcial ou total)</p>
            {pedido.itens.length > 1 && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={mesmoMotivo}
                  onChange={(e) => setMesmoMotivo(e.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                Usar o mesmo motivo para todos os itens
              </label>
            )}
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              {pedido.itens.map((item) => {
                const devolvendo = Number(quantidades[item.produtoId] || 0) > 0
                return (
                  <div key={item.produtoId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-800">{item.nome}</p>
                        <p className="text-[11px] text-gray-500">
                          No pedido: {item.quantidade} caixa(s)
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={item.quantidade}
                        value={quantidades[item.produtoId] ?? ''}
                        onChange={(e) =>
                          alterarQuantidadeDevolvida(
                            item.produtoId,
                            e.target.value,
                            item.quantidade,
                          )
                        }
                        className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-center text-sm outline-none focus:border-red-400"
                        placeholder="0"
                      />
                    </div>
                    {devolvendo && !usarMotivoGeral && (
                      <div className="rounded-lg bg-white p-2">
                        <p className="mb-1.5 text-[11px] font-medium text-gray-600">Motivos</p>
                        <MotivosDevolucao
                          valor={motivosPorItem[item.produtoId] ?? SELECAO_VAZIA}
                          onChange={(valor) =>
                            setMotivosPorItem((atual) => ({ ...atual, [item.produtoId]: valor }))
                          }
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {usarMotivoGeral && itensComQuantidade.length > 0 && (
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-1.5 text-xs font-medium text-gray-700">
                  Motivos{mesmoMotivo ? ' (todos os itens)' : ''}
                </p>
                <MotivosDevolucao valor={motivoGeral} onChange={setMotivoGeral} />
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-gray-700">Fotos da caixa (3 fotos)</span>
          <label className="mt-1 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-red-300 bg-red-50 text-sm font-medium text-red-700">
            <Camera className="h-4 w-4" /> Selecionar fotos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onSelecionarArquivos}
            />
          </label>
        </label>

        {arquivos.length > 0 && (
          <p className="text-xs text-gray-500">{arquivos.map((a) => a.name).join(' • ')}</p>
        )}

        <label className="block">
          <span className="text-xs font-medium text-gray-700">Observação (opcional)</span>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="Ex.: caixa com avaria"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-400"
          />
        </label>

        {erro && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{erro}</p>
        )}

        <button
          type="button"
          onClick={() => criar.mutate()}
          disabled={!podeEnviar}
          className="h-11 w-full cursor-pointer rounded-lg bg-red-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {criar.isPending ? 'Enviando...' : 'Registrar devolução'}
        </button>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">MINHAS DEVOLUÇÕES</h2>
        {isLoading && <p className="brand-loading text-sm text-gray-500">Carregando...</p>}
        {!isLoading && (devolucoes as any[]).length === 0 && (
          <p className="rounded-xl border bg-white px-4 py-6 text-center text-sm text-gray-500">
            Nenhuma devolução registrada.
          </p>
        )}
        <div className="space-y-2">
          {(devolucoes as any[]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDevolucaoSelecionada(item)}
              className="w-full cursor-pointer rounded-xl border bg-white p-3 text-left transition hover:border-red-300 hover:bg-red-50/30"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  Pedido #{String(item.pedidoNumero ?? '').padStart(6, '0')}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[item.status] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {item.cliente ?? 'Cliente não identificado'}
              </p>
              <p className="mt-1 text-xs text-gray-500">Etiqueta: {item.etiquetaToken ?? '—'}</p>
              {item.itensDevolvidos && (
                <p className="mt-1 text-xs text-gray-600">Itens: {item.itensDevolvidos}</p>
              )}
              {item.quantidadeCaixas && (
                <p className="mt-1 text-xs text-gray-600">
                  Caixas devolvidas: {item.quantidadeCaixas}
                </p>
              )}
              {item.resposta && (
                <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">
                  Resposta: {item.resposta}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                {item.status === 'CONCLUIDA' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                )}
                {item.status === 'NEGADA' && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                {item.status === 'PENDENTE' && (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                )}
                <span className="text-gray-500">
                  {new Date(item.criadoEm).toLocaleDateString('pt-BR')} · {item.fotos?.length ?? 0}{' '}
                  fotos
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {devolucaoSelecionada && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Detalhe da devolução
                </p>
                <h3 className="text-base font-semibold text-gray-900">
                  Pedido #{String(devolucaoSelecionada.pedidoNumero ?? '').padStart(6, '0')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDevolucaoSelecionada(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
                aria-label="Fechar"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Status</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[devolucaoSelecionada.status] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {STATUS_LABEL[devolucaoSelecionada.status] ?? devolucaoSelecionada.status}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Cliente</span>
                <span className="text-right font-medium text-gray-900">
                  {devolucaoSelecionada.cliente ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Etiqueta</span>
                <span className="text-right font-mono text-xs text-gray-900">
                  {devolucaoSelecionada.etiquetaToken ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Registrado por</span>
                <span className="text-right text-gray-900">
                  {devolucaoSelecionada.registradoPor ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Data</span>
                <span className="text-right text-gray-900">
                  {new Date(devolucaoSelecionada.criadoEm).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>

            {(devolucaoSelecionada.itensDevolvidos || devolucaoSelecionada.quantidadeCaixas) && (
              <div className="mt-3 rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Itens devolvidos
                </p>
                {devolucaoSelecionada.itensDevolvidos && (
                  <p className="mt-2 text-sm text-gray-700">
                    {devolucaoSelecionada.itensDevolvidos}
                  </p>
                )}
                {devolucaoSelecionada.quantidadeCaixas && (
                  <p className="mt-2 text-xs text-gray-600">
                    Caixas devolvidas: {devolucaoSelecionada.quantidadeCaixas}
                  </p>
                )}
                {devolucaoSelecionada.valorDevolucao != null && (
                  <p className="mt-2 text-xs text-gray-600">
                    Valor:{' '}
                    {Number(devolucaoSelecionada.valorDevolucao).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                )}
              </div>
            )}

            {Array.isArray(devolucaoSelecionada.itens) && devolucaoSelecionada.itens.length > 0 && (
              <div className="mt-3 rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Detalhe dos itens
                </p>
                <div className="mt-2 space-y-2">
                  {devolucaoSelecionada.itens.map((item: any, index: number) => (
                    <div
                      key={`${item.produtoId ?? index}-${item.nome ?? 'item'}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white px-2 py-1.5 text-xs text-gray-700"
                    >
                      <span>
                        {item.nome}
                        {item.motivosTexto && (
                          <span className="block text-[11px] text-gray-500">
                            Motivos: {item.motivosTexto}
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-gray-900">
                        {Number(item.quantidade ?? 0)}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {devolucaoSelecionada.observacao && (
              <div className="mt-3 rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Observação
                </p>
                <p className="mt-2 text-sm text-gray-700">{devolucaoSelecionada.observacao}</p>
              </div>
            )}

            {devolucaoSelecionada.resposta && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Resposta do admin
                </p>
                <p className="mt-2 text-sm text-red-700">{devolucaoSelecionada.resposta}</p>
              </div>
            )}

            {Array.isArray(devolucaoSelecionada.fotos) && devolucaoSelecionada.fotos.length > 0 && (
              <div className="mt-3 rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Fotos da devolução ({devolucaoSelecionada.fotos.length})
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {devolucaoSelecionada.fotos.map((foto: string, index: number) => {
                    const url = resolveAssetUrl(foto)
                    return (
                      <a
                        key={`${foto}-${index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-gray-200 bg-white"
                      >
                        <img
                          src={url}
                          alt={`Foto da devolução ${index + 1}`}
                          className="h-24 w-full object-cover"
                        />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
