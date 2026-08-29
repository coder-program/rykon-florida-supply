import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Printer, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', ENVIADO: 'Enviado', EM_CONFERENCIA: 'Em conferência',
  APROVADO: 'Aprovado', SEPARACAO_ENTREGA: 'Em separação/entrega',
  ENTREGUE: 'Entregue', FATURADO: 'Faturado', PAGO: 'Pago', CANCELADO: 'Cancelado',
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export function EtiquetaPage() {
  const { id } = useParams<{ id: string }>()

  const { data: etiqueta, isLoading, isError } = useQuery({
    queryKey: ['etiqueta', id],
    queryFn: () => api.get(`/etiquetas/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const reimprimir = useMutation({
    mutationFn: () => api.post(`/etiquetas/${id}/reimprimir`),
  })

  useEffect(() => {
    if (etiqueta) {
      document.title = `Etiqueta #${String(etiqueta.pedido.numero).padStart(6, '0')} — Flórida Hortifruti`
    }
  }, [etiqueta])

  function handleImprimir() {
    reimprimir.mutate()
    window.print()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Gerando etiqueta...</span>
        </div>
      </div>
    )
  }

  if (isError || !etiqueta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500">Etiqueta não encontrada.</p>
      </div>
    )
  }

  const p = etiqueta.pedido
  const c = etiqueta.cliente

  return (
    <>
      {/* Barra de ações — só aparece na tela, some na impressão */}
      <div className="no-print bg-gray-800 text-white px-6 py-3 flex items-center justify-between">
        <div>
          <p className="font-semibold">
            Etiqueta — Pedido #{String(p.numero).padStart(6, '0')}
          </p>
          {etiqueta.reimpressoes > 0 && (
            <p className="text-xs text-gray-400">{etiqueta.reimpressoes} reimpressão(ões) anteriores</p>
          )}
        </div>
        <button
          onClick={handleImprimir}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Printer className="w-4 h-4" />
          Imprimir Etiqueta
        </button>
      </div>

      {/* Área de pré-visualização */}
      <div className="no-print min-h-screen bg-gray-200 flex items-start justify-center py-8">
        <div className="label-preview bg-white shadow-2xl">
          <LabelContent etiqueta={etiqueta} />
        </div>
      </div>

      {/* Área de impressão — só aparece quando imprimir */}
      <div className="print-only">
        <LabelContent etiqueta={etiqueta} />
      </div>

      <style>{`
        /* ── Layout geral ── */
        .label-preview {
          width: 80mm;
          min-height: 120mm;
          padding: 4mm;
          font-family: 'Courier New', monospace;
          font-size: 10pt;
        }

        /* ── Controle de impressão (térmica 80mm) ── */
        @media print {
          @page { size: 80mm auto; margin: 0; }

          body > * { display: none !important; }
          .print-only { display: block !important; }
          .print-only .label-content {
            width: 80mm;
            padding: 3mm 4mm;
            font-family: 'Courier New', monospace;
            font-size: 9pt;
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
  const emp = etiqueta.empresa

  return (
    <div className="label-content" style={{ fontFamily: "'Courier New', monospace" }}>
      {/* Cabeçalho da empresa */}
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '3mm', marginBottom: '3mm' }}>
        <p style={{ fontWeight: 'bold', fontSize: '12pt' }}>{emp.nome}</p>
        <p style={{ fontSize: '8pt' }}>CNPJ: {emp.cnpj}</p>
        <p style={{ fontSize: '8pt' }}>Tel: {emp.telefone}</p>
      </div>

      {/* Número do pedido */}
      <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
        <p style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '1px' }}>
          PEDIDO Nº {String(p.numero).padStart(6, '0')}
        </p>
        <p style={{ fontSize: '8pt', color: '#444' }}>
          {formatDate(p.data)} &nbsp;|&nbsp; {STATUS_LABEL[p.status] ?? p.status}
        </p>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {/* Cliente */}
      <div style={{ marginBottom: '3mm' }}>
        <p style={{ fontSize: '8pt', textTransform: 'uppercase', color: '#555', marginBottom: '1mm' }}>CLIENTE</p>
        <p style={{ fontWeight: 'bold', fontSize: '11pt' }}>{c.razaoSocialOuNome}</p>
        {c.nomeFantasia && <p style={{ fontSize: '9pt' }}>{c.nomeFantasia}</p>}
      </div>

      {/* Endereço de entrega */}
      {(c.endereco || c.cidade) && (
        <div style={{ marginBottom: '3mm' }}>
          <p style={{ fontSize: '8pt', textTransform: 'uppercase', color: '#555', marginBottom: '1mm' }}>ENTREGA</p>
          {c.endereco && <p style={{ fontSize: '9pt' }}>{c.endereco}</p>}
          {c.cidade && (
            <p style={{ fontSize: '9pt' }}>
              {c.cidade}{c.estado ? `/${c.estado}` : ''}
            </p>
          )}
          {c.telefone && <p style={{ fontSize: '9pt' }}>Tel: {c.telefone}</p>}
        </div>
      )}

      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {/* Produtos */}
      <div style={{ marginBottom: '3mm' }}>
        <p style={{ fontSize: '8pt', textTransform: 'uppercase', color: '#555', marginBottom: '2mm' }}>PRODUTOS</p>
        {etiqueta.itens.map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', marginBottom: '1mm' }}>
            <span style={{ fontWeight: 'bold' }}>{item.codigo}</span>
            <span style={{ flex: 1, marginLeft: '4mm' }}>{item.nome}</span>
            <span style={{ fontWeight: 'bold', marginLeft: '2mm' }}>
              {item.quantidade} {item.unidade.toLowerCase()}
            </span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

      {/* Vendedor */}
      <p style={{ fontSize: '9pt', marginBottom: '3mm' }}>
        <span style={{ color: '#555' }}>VENDEDOR: </span>
        <strong>{etiqueta.vendedor.nome}</strong>
      </p>

      {/* Observações */}
      {p.observacoes && (
        <p style={{ fontSize: '8pt', color: '#444', marginBottom: '3mm', fontStyle: 'italic' }}>
          Obs: {p.observacoes}
        </p>
      )}

      {/* QR Code */}
      {etiqueta.qrCodeDataUrl && (
        <div style={{ textAlign: 'center', marginTop: '3mm' }}>
          <img
            src={etiqueta.qrCodeDataUrl}
            alt="QR Code do pedido"
            style={{ width: '30mm', height: '30mm', margin: '0 auto' }}
          />
          <p style={{ fontSize: '7pt', color: '#666', marginTop: '1mm' }}>
            Escaneie para ver o status do pedido
          </p>
        </div>
      )}

      {/* Rodapé */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '3mm', paddingTop: '2mm', textAlign: 'center' }}>
        <p style={{ fontSize: '7pt', color: '#888' }}>
          Token: {etiqueta.tokenPublico?.slice(0, 8).toUpperCase()}
        </p>
      </div>
    </div>
  )
}
