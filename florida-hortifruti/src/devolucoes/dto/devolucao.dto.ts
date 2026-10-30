import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FORMAS_PAGAMENTO_ATIVAS, MENSAGEM_FORMA_INVALIDA } from '../../common/formas-pagamento';

export enum MotivoDevolucao {
  ESTRAGADO = 'ESTRAGADO',
  REFUGO = 'REFUGO',
  MELADO = 'MELADO',
  MUITO_MADURO = 'MUITO_MADURO',
  MUITO_VERDE = 'MUITO_VERDE',
  OUTROS = 'OUTROS',
}

export class CriarDevolucaoItemDto {
  @IsString()
  produtoId: string;

  @IsInt()
  @Min(1)
  quantidade: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um motivo para cada item devolvido' })
  @IsEnum(MotivoDevolucao, { each: true })
  motivos: MotivoDevolucao[];

  // Obrigatório quando "OUTROS" está entre os motivos (validado no service)
  @IsOptional()
  @IsString()
  motivoOutro?: string;
}

// Informe o pedido (escolhido na lista) ou o token da etiqueta (QR); um dos dois é obrigatório
export class CriarDevolucaoDto {
  @IsOptional()
  @IsString()
  pedidoId?: string;

  @IsOptional()
  @IsString()
  etiquetaToken?: string;

  // 3 fotos; administrador e administrativo registram sem foto (validado no service)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  fotos?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriarDevolucaoItemDto)
  itens: CriarDevolucaoItemDto[];

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  itensDevolvidos?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeCaixas?: number;
}

export enum StatusDevolucao {
  PENDENTE = 'PENDENTE',
  // Aprovada, aguardando o reembolso ao cliente
  APROVADA = 'APROVADA',
  CONCLUIDA = 'CONCLUIDA',
  NEGADA = 'NEGADA',
}

export class AtualizarStatusDevolucaoDto {
  @IsIn([StatusDevolucao.APROVADA, StatusDevolucao.NEGADA])
  status: StatusDevolucao.APROVADA | StatusDevolucao.NEGADA;

  @IsOptional()
  @IsString()
  resposta?: string;
}

export enum TipoReembolso {
  CAIXAS = 'CAIXAS',
  DINHEIRO = 'DINHEIRO',
}

export class RegistrarReembolsoDto {
  @IsEnum(TipoReembolso)
  tipo: TipoReembolso;

  // Dia em que o reembolso foi feito (YYYY-MM-DD)
  @IsString()
  data: string;

  // Em caixas
  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeCaixas?: number;

  @IsOptional()
  @IsString()
  loteId?: string;

  // Em dinheiro
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  valor?: number;

  @IsOptional()
  @IsIn(FORMAS_PAGAMENTO_ATIVAS, { message: MENSAGEM_FORMA_INVALIDA })
  formaPagamento?: string;

  // Perda: as caixas devolvidas não voltam ao estoque
  @IsInt()
  @Min(1)
  perdaQuantidade: number;

  @IsString()
  perdaLoteId: string;

  // Valor perdido, informado no reembolso em dinheiro
  @IsOptional()
  @IsNumber()
  @Min(0)
  perdaValor?: number;
}
