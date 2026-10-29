import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FormaPagamento } from '@prisma/client';
import { FORMAS_PAGAMENTO_ATIVAS, MENSAGEM_FORMA_INVALIDA } from '../../common/formas-pagamento';

export class RegistrarPagamentoDto {
  @IsNumber()
  @Min(0.01)
  valor: number;

  // Como o cliente pagou; vazio = a forma do pedido
  @IsOptional()
  @IsIn(FORMAS_PAGAMENTO_ATIVAS, { message: MENSAGEM_FORMA_INVALIDA })
  formaPagamento?: FormaPagamento;

  @IsOptional()
  @IsString()
  observacao?: string;

  // Dia em que o cliente realmente pagou (YYYY-MM-DD); vazio = hoje
  @IsOptional()
  @IsString()
  data?: string;
}

export class MarcarPagoDto {
  // Dia em que o cliente realmente pagou (YYYY-MM-DD); vazio = hoje
  @IsOptional()
  @IsString()
  data?: string;

  // Como o cliente pagou; vazio = a forma do pedido
  @IsOptional()
  @IsIn(FORMAS_PAGAMENTO_ATIVAS, { message: MENSAGEM_FORMA_INVALIDA })
  formaPagamento?: FormaPagamento;
}
