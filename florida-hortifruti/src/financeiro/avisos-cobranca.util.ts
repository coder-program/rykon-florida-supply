// Textos dos avisos de cobrança enviados ao cliente (portal e WhatsApp).
// Compra a prazo gera 3 avisos: na compra, 3 dias antes do vencimento e no dia (se não pago).

export type TipoAvisoCobranca = 'COMPRA_A_PRAZO' | 'VENCE_EM_3_DIAS' | 'VENCIMENTO_HOJE';

const formatarBRL = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Fecho de todos os avisos, logo depois da data de vencimento
export const FECHO_AVISO = 'Qualquer coisa ficamos à disposição,\nFlorida Supply Hortifruti ;)';

// dataVencimento é gravada como meia-noite UTC do dia escolhido
const formatarData = (data: Date) => data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

// "Hoje" no fuso de Brasília, como meia-noite UTC (mesma base da dataVencimento)
export function hojeBrasilia() {
  return new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
}

export function montarAvisoCobranca(
  tipo: TipoAvisoCobranca,
  dados: { numeroPedido: number; valor: number; vencimento: Date; vencido?: boolean },
) {
  const valor = formatarBRL(dados.valor);
  const data = formatarData(dados.vencimento);
  const pedido = `pedido nº ${dados.numeroPedido}`;

  const comFecho = (texto: string) => `${texto}\n\n${FECHO_AVISO}`;

  if (tipo === 'COMPRA_A_PRAZO') {
    return {
      titulo: 'Compra registrada',
      mensagem: comFecho(
        `Sua compra do ${pedido} foi registrada. Você tem ${valor} para pagar conosco até ${data}.`,
      ),
    };
  }
  if (tipo === 'VENCE_EM_3_DIAS') {
    return {
      titulo: 'Pagamento vence em 3 dias',
      mensagem: comFecho(
        `Lembrete: o pagamento do ${pedido}, no valor de ${valor}, vence em ${data}.`,
      ),
    };
  }
  return {
    titulo: dados.vencido ? 'Pagamento vencido' : 'Pagamento vence hoje',
    mensagem: comFecho(
      dados.vencido
        ? `O pagamento do ${pedido} venceu em ${data} e ainda consta em aberto: ${valor}. Se já pagou, desconsidere.`
        : `O pagamento do ${pedido}, no valor de ${valor}, vence hoje (${data}). Se já pagou, desconsidere.`,
    ),
  };
}
