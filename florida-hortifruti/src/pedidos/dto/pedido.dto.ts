import { IsString, IsArray, IsNumber, IsBoolean, IsOptional, IsEnum, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { FormaPagamento, StatusPedido } from '@prisma/client';

class ItemPedidoDto {
  @IsString()
  produtoId: string;

  @IsNumber()
  quantidade: number;

  @IsNumber()
  valorUnitario: number;
}

export class CreatePedidoDto {
  @IsString()
  clienteId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens: ItemPedidoDto[];

  @IsOptional() @IsNumber()
  valorFrete?: number;

  @IsOptional() @IsBoolean()
  freteInclusoNoPreco?: boolean;

  @IsOptional() @IsNumber()
  descontoValor?: number;

  @IsOptional() @IsNumber()
  descontoPercentual?: number;

  @IsEnum(FormaPagamento)
  formaPagamento: FormaPagamento;

  @IsOptional() @IsString()
  dataVencimento?: string;

  @IsOptional() @IsString()
  condicaoNegociada?: string;

  @IsOptional() @IsBoolean()
  necessitaNF?: boolean;

  @IsOptional() @IsString()
  observacoes?: string;
}

// Seção 3.2: administrativo pode editar pedido antes de aprovar
export class UpdatePedidoDto {
  @IsOptional() @IsString()
  clienteId?: string;

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens?: ItemPedidoDto[];

  @IsOptional() @IsNumber()
  valorFrete?: number;

  @IsOptional() @IsBoolean()
  freteInclusoNoPreco?: boolean;

  @IsOptional() @IsNumber()
  descontoValor?: number;

  @IsOptional() @IsNumber()
  descontoPercentual?: number;

  @IsOptional() @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;

  @IsOptional() @IsString()
  dataVencimento?: string;

  @IsOptional() @IsString()
  condicaoNegociada?: string;

  @IsOptional() @IsBoolean()
  necessitaNF?: boolean;

  @IsOptional() @IsString()
  observacoes?: string;
}

// Seção 19: filtros para listagem de pedidos
export class FiltrosPedidoDto {
  @IsOptional() @IsString()
  clienteId?: string;

  @IsOptional() @IsString()
  vendedorId?: string;

  @IsOptional() @IsEnum(StatusPedido)
  status?: StatusPedido;

  @IsOptional() @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;

  @IsOptional() @IsString()
  dataInicio?: string;

  @IsOptional() @IsString()
  dataFim?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  necessitaNF?: boolean;
}
