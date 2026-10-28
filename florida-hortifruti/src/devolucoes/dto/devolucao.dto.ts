import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  fotos: string[];

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
  CONCLUIDA = 'CONCLUIDA',
  NEGADA = 'NEGADA',
}

export class AtualizarStatusDevolucaoDto {
  @IsEnum(StatusDevolucao)
  status: StatusDevolucao;

  @IsOptional()
  @IsString()
  resposta?: string;
}
