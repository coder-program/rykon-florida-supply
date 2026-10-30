// Textos dos avisos de cobrança enviados ao cliente (portal e WhatsApp).
// Compra a prazo gera 3 avisos: na compra, 3 dias antes do vencimento e no dia (se não pago).

export type TipoAvisoCobranca = 'COMPRA_A_PRAZO' | 'VENCE_EM_3_DIAS' | 'VENCIMENTO_HOJE';

const CHAVE_PIX = '11 91205-0672';

const formatarBRL = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// A data do pedido é um instante: o dia da compra é o de Brasília
const formatarData = (data: Date) =>
  data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// "Hoje" no fuso de Brasília, como meia-noite UTC (mesma base da dataVencimento)
export function hojeBrasilia() {
  return new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
}

const TITULOS: Record<TipoAvisoCobranca, string> = {
  COMPRA_A_PRAZO: 'Compra registrada',
  VENCE_EM_3_DIAS: 'Pagamento vence em 3 dias',
  VENCIMENTO_HOJE: 'Pagamento vence hoje',
};

export function montarAvisoCobranca(
  tipo: TipoAvisoCobranca,
  dados: { cliente: string; dataCompra: Date; valor: number; vencido?: boolean },
) {
  return {
    titulo: dados.vencido ? 'Pagamento vencido' : TITULOS[tipo],
    mensagem: [
      `Olá, ${dados.cliente}! 🍓`,
      `Passando para lembrar que temos um valor em aberto referente à compra do dia ${formatarData(dados.dataCompra)}, no valor de ${formatarBRL(dados.valor)}.`,
      '',
      'Se já realizaram o pagamento, podem nos enviar o comprovante, por gentileza?',
      `Chave Pix: ${CHAVE_PIX}`,
      '',
      'Qualquer coisa, ficamos à disposição! ❤️',
      'Flórida Supply Hortifruti Ltda 🍓',
    ].join('\n'),
  };
}
