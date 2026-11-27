import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { formatBRL } from '../lib/utils'

// Só dígitos, com DDI 55 (wa.me exige o número completo)
function numeroWhatsApp(valor: string) {
  const d = valor.replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('55') && d.length >= 12 ? d : `55${d}`
}

function mensagemPedidoAprovado(p: any) {
  const numero = String(p.numero).padStart(6, '0')
  const itens = (p.itens ?? [])
    .map((i: any) => `• ${Number(i.quantidade)} cx ${i.produto?.nome ?? ''}`)
    .join('\n')
  return [
    `Olá, ${p.cliente?.nomeFantasia || p.cliente?.razaoSocialOuNome || ''}!`,
    `Seu pedido #${numero} da Flórida Hortifruti foi aprovado ✅`,
    itens,
    `Total: ${formatBRL(p.totalFinal)}`,
    '',
    `Acompanhe o pedido e a rota do motorista quando ele sair para a entrega:`,
    p.linkRastreio,
  ]
    .filter((l) => l !== undefined && l !== null)
    .join('\n')
}

// Após a aprovação: WhatsApp do cliente já preenchido e o pedido + link de rastreio prontos
export function CompartilharWhatsApp({ pedido, destaque }: { pedido: any; destaque?: boolean }) {
  const [numero, setNumero] = useState<string>(
    pedido.cliente?.whatsapp || pedido.cliente?.telefone || '',
  )
  if (!pedido.linkRastreio) return null
  const destino = numeroWhatsApp(numero)
  const url = `https://wa.me/${destino}?text=${encodeURIComponent(mensagemPedidoAprovado(pedido))}`

  return (
    <div
      className={`space-y-2 rounded-xl border p-3 ${destaque ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
    >
      <p className="text-sm font-semibold text-gray-900">
        {destaque ? 'Pedido aprovado! Envie para o cliente' : 'Compartilhar com o cliente'}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="WhatsApp do cliente"
          inputMode="tel"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="WhatsApp do cliente (DDD + número)"
          className="min-h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <a
          href={destino.length >= 12 ? url : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={destino.length < 12}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white ${destino.length >= 12 ? 'bg-[#1fa855] hover:bg-[#178a45]' : 'pointer-events-none bg-gray-300'}`}
        >
          <MessageCircle className="h-4 w-4" /> Compartilhar no WhatsApp
        </a>
      </div>
      <p className="text-xs text-gray-500">
        Vai o resumo do pedido e o link para o cliente acompanhar a entrega e a rota do motorista
        (sem login).
      </p>
    </div>
  )
}
