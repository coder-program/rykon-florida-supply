import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, XCircle } from 'lucide-react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { api } from '../lib/api'

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

export function DevolucoesPage() {
  const qc = useQueryClient()
  const scannerRef = useRef<BrowserQRCodeReader | null>(null)
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [etiquetaToken, setEtiquetaToken] = useState('')
  const [pedidoIdSelecionado, setPedidoIdSelecionado] = useState('')
  const [itensDevolvidos, setItensDevolvidos] = useState<Record<string, string>>({})
  const [pedidoPorEtiqueta, setPedidoPorEtiqueta] = useState<any | null>(null)
  const [observacao, setObservacao] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [erro, setErro] = useState('')
  const [mostrarSucesso, setMostrarSucesso] = useState(false)
  const [scannerAberto, setScannerAberto] = useState(false)

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-para-devolucao'],
    queryFn: () => api.get('/pedidos').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const { data: devolucoes = [], isLoading } = useQuery({
    queryKey: ['minhas-devolucoes'],
    queryFn: () => api.get('/devolucoes/minhas').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const criar = useMutation({
    mutationFn: async () => {
      if (!etiquetaToken.trim()) throw new Error('Informe o código da etiqueta')
      if (arquivos.length !== 3) throw new Error('Envie exatamente 3 fotos')

      const itens = Object.entries(itensDevolvidos)
        .map(([produtoId, quantidade]) => ({ produtoId, quantidade: Number(quantidade || 0) }))
        .filter((item) => item.quantidade > 0)

      const basePedido = pedidoSelecionado ?? pedidoPorEtiqueta
      if (!basePedido) {
        throw new Error('Selecione um pedido para informar os itens devolvidos')
      }

      if (itens.length === 0) {
        throw new Error('Informe ao menos um item devolvido')
      }

      const fotos = await Promise.all(arquivos.map((file) => toDataUrl(file)))

      const resumoItens = itens
        .map((item) => {
          const base = basePedido.itens.find((i: any) => i.produtoId === item.produtoId)
          return `${item.quantidade}x ${base?.nome ?? item.produtoId}`
        })
        .join(', ')

      const caixas = itens.reduce((acc, item) => acc + item.quantidade, 0)

      return api.post('/devolucoes', {
        etiquetaToken: etiquetaToken.trim(),
        itens,
        itensDevolvidos: resumoItens,
        quantidadeCaixas: caixas,
        observacao: observacao.trim() || undefined,
        fotos,
      })
    },
    onSuccess: () => {
      setPedidoIdSelecionado('')
      setEtiquetaToken('')
      setItensDevolvidos({})
      setPedidoPorEtiqueta(null)
      setObservacao('')
      setArquivos([])
      setErro('')
      setMostrarSucesso(true)
      qc.invalidateQueries({ queryKey: ['minhas-devolucoes'] })
      qc.invalidateQueries({ queryKey: ['devolucoes-resumo-home'] })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : msg || 'Não foi possível registrar a devolução')
    },
  })

  const podeEnviar = useMemo(() => {
    return !criar.isPending && etiquetaToken.trim().length > 0 && arquivos.length === 3
  }, [criar.isPending, etiquetaToken, arquivos])

  const pedidosComEtiqueta = useMemo(() => {
    return (pedidos as any[])
      .filter((p) => p?.etiqueta?.tokenPublico)
      .map((p) => ({
        id: String(p.id),
        numero: Number(p.numero ?? 0),
        cliente: p?.cliente?.razaoSocialOuNome ?? 'Cliente',
        etiquetaToken: String(p.etiqueta.tokenPublico),
        itens: (p.itens ?? []).map((i: any) => ({
          produtoId: String(i.produtoId),
          nome: String(i?.produto?.nome ?? 'Produto'),
          quantidade: Number(i.quantidade ?? 0),
        })),
      }))
  }, [pedidos])

  const pedidoSelecionado = useMemo(() => {
    return pedidosComEtiqueta.find((p) => p.id === pedidoIdSelecionado) ?? null
  }, [pedidosComEtiqueta, pedidoIdSelecionado])

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

  function selecionarPedidoComEtiqueta(id: string) {
    setPedidoIdSelecionado(id)
    setPedidoPorEtiqueta(null)
    const selecionado = pedidosComEtiqueta.find((p) => p.id === id)
    if (selecionado) {
      setEtiquetaToken(selecionado.etiquetaToken)
      const base: Record<string, string> = {}
      selecionado.itens.forEach((item) => {
        base[item.produtoId] = ''
      })
      setItensDevolvidos(base)
      setErro('')
    }
  }

  async function buscarPedidoPelaEtiqueta() {
    const token = etiquetaToken.trim()
    if (!token) return
    try {
      const data = await api
        .get(`/devolucoes/etiqueta/${encodeURIComponent(token)}`)
        .then((r) => r.data)
      setPedidoIdSelecionado('')
      setPedidoPorEtiqueta(data)
      setEtiquetaToken(String(data?.etiquetaToken ?? token))

      const base: Record<string, string> = {}
      ;(data?.itens ?? []).forEach((item: any) => {
        base[String(item.produtoId)] = ''
      })
      setItensDevolvidos(base)
      setErro('')
    } catch (e: any) {
      const msg = e?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : msg || 'Etiqueta não encontrada')
      setPedidoPorEtiqueta(null)
      setItensDevolvidos({})
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
    setItensDevolvidos((atual) => ({ ...atual, [produtoId]: valor }))
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
            setPedidoIdSelecionado('')
            setScannerAberto(false)
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
        Selecione o pedido com etiqueta ou escaneie o QR da caixa, e envie 3 fotos do produto
        devolvido.
      </p>

      <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-white p-4">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Pedido com etiqueta</span>
          <select
            value={pedidoIdSelecionado}
            onChange={(e) => selecionarPedidoComEtiqueta(e.target.value)}
            className="mt-1 h-11 w-full cursor-pointer rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-400"
          >
            <option value="">Selecionar pedido</option>
            {pedidosComEtiqueta.map((pedido) => (
              <option key={pedido.id} value={pedido.id}>
                Pedido #{String(pedido.numero).padStart(6, '0')} - {pedido.cliente}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700">
            Código da etiqueta (scan/manual)
          </span>
          <input
            value={etiquetaToken}
            onChange={(e) => {
              setEtiquetaToken(e.target.value)
              if (pedidoIdSelecionado) setPedidoIdSelecionado('')
            }}
            placeholder="Ex.: URL do QR ou token"
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-400"
          />
        </label>

        <button
          type="button"
          onClick={() => setScannerAberto((v) => !v)}
          className="h-10 w-full cursor-pointer rounded-lg border border-red-300 bg-white text-sm font-semibold text-red-700"
        >
          {scannerAberto ? 'Fechar câmera' : 'Escanear com câmera'}
        </button>

        {scannerAberto && (
          <div className="overflow-hidden rounded-lg border border-red-200 bg-black">
            <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline autoPlay />
          </div>
        )}

        {(pedidoSelecionado || pedidoPorEtiqueta) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            Vinculado ao pedido #
            {String((pedidoSelecionado?.numero ?? pedidoPorEtiqueta?.pedidoNumero) || '').padStart(
              6,
              '0',
            )}{' '}
            ({pedidoSelecionado?.cliente ?? pedidoPorEtiqueta?.cliente})
          </p>
        )}

        <button
          type="button"
          onClick={buscarPedidoPelaEtiqueta}
          className="h-10 w-full cursor-pointer rounded-lg border border-red-300 bg-red-50 text-sm font-semibold text-red-700"
        >
          Buscar pedido pela etiqueta escaneada
        </button>

        {(pedidoSelecionado || pedidoPorEtiqueta) &&
          (pedidoSelecionado?.itens ?? pedidoPorEtiqueta?.itens ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">
                Itens devolvidos (parcial ou total)
              </p>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                {(pedidoSelecionado?.itens ?? pedidoPorEtiqueta?.itens ?? []).map((item: any) => (
                  <div key={item.produtoId} className="flex items-center gap-2">
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
                      value={itensDevolvidos[item.produtoId] ?? ''}
                      onChange={(e) =>
                        alterarQuantidadeDevolvida(item.produtoId, e.target.value, item.quantidade)
                      }
                      className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-center text-sm outline-none focus:border-red-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
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
        {isLoading && <p className="text-sm text-gray-500">Carregando...</p>}
        {!isLoading && (devolucoes as any[]).length === 0 && (
          <p className="rounded-xl border bg-white px-4 py-6 text-center text-sm text-gray-500">
            Nenhuma devolução registrada.
          </p>
        )}
        <div className="space-y-2">
          {(devolucoes as any[]).map((item) => (
            <div key={item.id} className="rounded-xl border bg-white p-3">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
