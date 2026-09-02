import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Leaf, MapPin, Package, Printer, RefreshCw, ShoppingCart, User } from 'lucide-react'
import { api } from '../lib/api'

function numeroPedido(n: number | string) {
  return `#${String(n).padStart(6, '0')}`
}

function totalCaixasDe(etiqueta: { totalCaixas?: number; itens?: { quantidade?: number }[] }) {
  if (etiqueta.totalCaixas && etiqueta.totalCaixas > 0) return etiqueta.totalCaixas
  const soma = (etiqueta.itens ?? []).reduce(
    (acc, item) => acc + Math.round(Number(item.quantidade) || 0),
    0,
  )
  return Math.max(1, soma)
}

function linhasEndereco(c: {
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
}) {
  const linhas: string[] = []
  if (c.endereco) linhas.push(c.endereco)
  const cidadeUf = [c.cidade, c.estado].filter(Boolean).join(' – ')
  if (cidadeUf) linhas.push(cidadeUf)
  return linhas.length > 0 ? linhas : ['Endereço não informado']
}

export function EtiquetaPage() {
  const { id } = useParams<{ id: string }>()

  const {
    data: etiqueta,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['etiqueta', id],
    queryFn: () => api.get(`/etiquetas/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const reimprimir = useMutation({
    mutationFn: () => api.post(`/etiquetas/${id}/reimprimir`),
  })

  const totalCaixas = useMemo(() => (etiqueta ? totalCaixasDe(etiqueta) : 1), [etiqueta])

  useEffect(() => {
    if (etiqueta) {
      document.title = `${totalCaixas} etiquetas ${numeroPedido(etiqueta.pedido.numero)} — Flórida Supply`
    }
  }, [etiqueta, totalCaixas])

  function handleImprimir() {
    reimprimir.mutate()
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Gerando etiquetas...</span>
        </div>
      </div>
    )
  }

  if (isError || !etiqueta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-red-500">Etiqueta não encontrada.</p>
      </div>
    )
  }

  const p = etiqueta.pedido
  const vias = Array.from({ length: totalCaixas }, (_, i) => i + 1)

  return (
    <>
      <div className="no-print flex items-center justify-between bg-gray-800 px-4 py-3 text-white sm:px-6">
        <div>
          <p className="font-semibold">
            {totalCaixas} etiqueta{totalCaixas === 1 ? '' : 's'} — Pedido {numeroPedido(p.numero)}
          </p>
          <p className="text-xs text-gray-400">
            60×40 mm · uma via por caixa
            {etiqueta.reimpressoes > 0 ? ` · ${etiqueta.reimpressoes} reimpressão(ões)` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={handleImprimir}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir {totalCaixas} etiqueta{totalCaixas === 1 ? '' : 's'}
        </button>
      </div>

      <div className="labels-wrap">
        {vias.map((caixa) => (
          <div key={caixa} className="label-sheet">
            <LabelContent etiqueta={etiqueta} caixa={caixa} totalCaixas={totalCaixas} />
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        .label-sheet,
        .label-content {
          width: 60mm;
          height: 40mm;
          box-sizing: border-box;
          font-family: Inter, Roboto, sans-serif;
          color: #000;
          background: #fff;
        }

        .labels-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          min-height: 100vh;
          padding: 32px 16px;
          background: #e5e7eb;
        }

        .label-sheet { box-shadow: 0 10px 30px rgba(0,0,0,0.18); }

        @media print {
          @page { size: 60mm 40mm; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          .no-print { display: none !important; }
          .labels-wrap {
            display: block;
            gap: 0;
            min-height: 0;
            padding: 0;
            background: #fff;
          }
          .label-sheet {
            box-shadow: none;
            page-break-after: always;
            break-after: page;
          }
          .label-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </>
  )
}

function LabelContent({
  etiqueta,
  caixa,
  totalCaixas,
}: {
  etiqueta: any
  caixa: number
  totalCaixas: number
}) {
  const p = etiqueta.pedido
  const c = etiqueta.cliente
  const endereco = linhasEndereco(c)

  return (
    <div className="label-content" style={{ display: 'flex', padding: '1.6mm 1.8mm 1.4mm' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingRight: '1.6mm',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1mm', marginBottom: '1mm' }}>
          <Leaf size={10} strokeWidth={2.4} />
          <p style={{ fontSize: '6pt', fontWeight: 700, letterSpacing: '0.02em', margin: 0 }}>
            Flórida Supply
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2mm', minWidth: 0 }}>
          <ShoppingCart size={9} strokeWidth={2.2} />
          <p style={{ fontSize: '6.2pt', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
            Nº PEDIDO: {numeroPedido(p.numero)}
          </p>
          <span style={{ width: '0.25mm', height: '3.4mm', background: '#000', flexShrink: 0 }} />
          <Package size={9} strokeWidth={2.2} />
          <p style={{ fontSize: '6.2pt', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
            CAIXA: {caixa}/{totalCaixas}
          </p>
        </div>

        <div style={{ borderTop: '0.25mm dashed #000', margin: '1.1mm 0' }} />

        <div style={{ display: 'flex', gap: '1.1mm', alignItems: 'flex-start' }}>
          <User size={9} strokeWidth={2.2} style={{ marginTop: '0.3mm' }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '5pt', fontWeight: 700, letterSpacing: '0.03em', margin: 0 }}>
              CLIENTE:
            </p>
            <p
              style={{
                fontSize: '7pt',
                fontWeight: 700,
                lineHeight: 1.15,
                margin: '0.3mm 0 0',
                overflow: 'hidden',
              }}
            >
              {c.razaoSocialOuNome}
            </p>
          </div>
        </div>

        <div style={{ borderTop: '0.25mm dashed #000', margin: '1.1mm 0' }} />

        <div style={{ display: 'flex', gap: '1.1mm', alignItems: 'flex-start' }}>
          <MapPin size={9} strokeWidth={2.2} style={{ marginTop: '0.3mm' }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '5pt', fontWeight: 700, letterSpacing: '0.03em', margin: 0 }}>
              ENDEREÇO:
            </p>
            {endereco.map((linha) => (
              <p
                key={linha}
                style={{
                  fontSize: '6pt',
                  lineHeight: 1.2,
                  margin: '0.25mm 0 0',
                  overflow: 'hidden',
                }}
              >
                {linha}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          width: '20mm',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {etiqueta.qrCodeDataUrl && (
          <img
            src={etiqueta.qrCodeDataUrl}
            alt="QR Code do pedido"
            style={{ width: '16.5mm', height: '16.5mm' }}
          />
        )}
        <p
          style={{
            fontSize: '4.4pt',
            lineHeight: 1.15,
            textAlign: 'center',
            margin: '0.8mm 0 0',
            fontWeight: 600,
          }}
        >
          Escaneie para ver os detalhes do pedido
        </p>
      </div>
    </div>
  )
}
