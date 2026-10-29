import { FormaPagamento } from '@prisma/client';

// Formas que podem ser escolhidas hoje. BOLETO e OUTROS existem só em registros antigos.
export const FORMAS_PAGAMENTO_ATIVAS: FormaPagamento[] = [
  FormaPagamento.PIX,
  FormaPagamento.DINHEIRO,
  FormaPagamento.FATURADO,
  FormaPagamento.LINK_PAGAMENTO,
  FormaPagamento.CARTAO_CREDITO,
  FormaPagamento.CARTAO_DEBITO,
];

export const MENSAGEM_FORMA_INVALIDA =
  'Forma de pagamento inválida. Use Pix, Dinheiro, Faturado, Link de pagamento, Cartão de crédito ou Cartão de débito';
