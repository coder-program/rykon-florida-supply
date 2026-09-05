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

export class CriarDevolucaoItemDto {
  @IsString()
  produtoId: string;

  @IsInt()
  @Min(1)
  quantidade: number;
}

export class CriarDevolucaoDto {
  @IsString()
  etiquetaToken: string;

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
