import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MapPin, Printer, RefreshCw, ShoppingCart, User } from 'lucide-react'
import { api } from '../lib/api'

function numeroPedido(n: number | string) {
  return `#${String(n).padStart(6, '0')}`
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

  useEffect(() => {
    if (etiqueta) {
      document.title = `Etiqueta ${numeroPedido(etiqueta.pedido.numero)} — Flórida Hortifruti`
    }
  }, [etiqueta])

  function handleImprimir() {
    reimprimir.mutate()
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Gerando etiqueta...</span>
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

  return (
    <>
      <div className="no-print flex items-center justify-between bg-gray-800 px-4 py-3 text-white sm:px-6">
        <div>
          <p className="font-semibold">Etiqueta — Pedido {numeroPedido(p.numero)}</p>
          {etiqueta.reimpressoes > 0 && (
            <p className="text-xs text-gray-400">
              {etiqueta.reimpressoes} reimpressão(ões) anteriores
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleImprimir}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir Etiqueta
        </button>
      </div>

      <div className="no-print flex min-h-screen items-start justify-center bg-gray-200 py-8">
        <div className="label-sheet bg-white shadow-2xl">
          <LabelContent etiqueta={etiqueta} />
        </div>
      </div>

      <div className="print-only">
        <LabelContent etiqueta={etiqueta} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        .label-sheet,
        .label-content {
          width: 70mm;
          height: 40mm;
          box-sizing: border-box;
          font-family: Inter, Roboto, sans-serif;
          color: #000;
          background: #fff;
        }

        .label-sheet { padding: 0; }

        @media print {
          @page { size: 70mm 40mm; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-only .label-content {
            width: 70mm;
            height: 40mm;
          }
        }

        .no-print { display: block; }
        .print-only { display: none; }
      `}</style>
    </>
  )
}

function LabelContent({ etiqueta }: { etiqueta: any }) {
  const p = etiqueta.pedido
  const c = etiqueta.cliente
  const endereco = linhasEndereco(c)

  return (
    <div className="label-content" style={{ display: 'flex', padding: '2.2mm 2.4mm' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingRight: '2mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '1.4mm', alignItems: 'flex-start' }}>
          <ShoppingCart size={11} strokeWidth={2.2} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '5.2pt', fontWeight: 700, letterSpacing: '0.04em', margin: 0 }}>
              NÚMERO DO PEDIDO:
            </p>
            <p style={{ fontSize: '13pt', fontWeight: 700, lineHeight: 1.05, margin: '0.4mm 0 0' }}>
              {numeroPedido(p.numero)}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.4mm', alignItems: 'flex-start' }}>
          <User size={11} strokeWidth={2.2} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '5.2pt', fontWeight: 700, letterSpacing: '0.04em', margin: 0 }}>
              NOME DO CLIENTE:
            </p>
            <p
              style={{
                fontSize: '8pt',
                fontWeight: 600,
                lineHeight: 1.15,
                margin: '0.4mm 0 0',
                overflow: 'hidden',
              }}
            >
              {c.razaoSocialOuNome}
              {c.nomeFantasia ? ` (${c.nomeFantasia})` : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.4mm', alignItems: 'flex-start' }}>
          <MapPin size={11} strokeWidth={2.2} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '5.2pt', fontWeight: 700, letterSpacing: '0.04em', margin: 0 }}>
              ENDEREÇO DO CLIENTE:
            </p>
            {endereco.map((linha) => (
              <p
                key={linha}
                style={{
                  fontSize: '6.6pt',
                  lineHeight: 1.2,
                  margin: '0.3mm 0 0',
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
          width: '24mm',
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
            style={{ width: '20mm', height: '20mm' }}
          />
        )}
        <p
          style={{
            fontSize: '5pt',
            lineHeight: 1.2,
            textAlign: 'center',
            margin: '1mm 0 0',
            fontWeight: 600,
          }}
        >
          Escaneie para ver os detalhes do pedido
        </p>
      </div>
    </div>
  )
}
