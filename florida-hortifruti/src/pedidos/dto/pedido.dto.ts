import {
  IsString,
  IsArray,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { FormaPagamento, StatusPedido, StatusSolicitacaoAlteracao } from '@prisma/client';

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

  @IsOptional()
  @IsNumber()
  valorFrete?: number;

  @IsOptional()
  @IsBoolean()
  freteInclusoNoPreco?: boolean;

  @IsOptional()
  @IsNumber()
  descontoValor?: number;

  @IsOptional()
  @IsNumber()
  descontoPercentual?: number;

  @IsEnum(FormaPagamento)
  formaPagamento: FormaPagamento;

  @IsOptional()
  @IsString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  condicaoNegociada?: string;

  @IsOptional()
  @IsBoolean()
  necessitaNF?: boolean;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

// Seção 3.2: administrativo pode editar pedido antes de aprovar
export class UpdatePedidoDto {
  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens?: ItemPedidoDto[];

  @IsOptional()
  @IsNumber()
  valorFrete?: number;

  @IsOptional()
  @IsBoolean()
  freteInclusoNoPreco?: boolean;

  @IsOptional()
  @IsNumber()
  descontoValor?: number;

  @IsOptional()
  @IsNumber()
  descontoPercentual?: number;

  @IsOptional()
  @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;

  @IsOptional()
  @IsString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  condicaoNegociada?: string;

  @IsOptional()
  @IsBoolean()
  necessitaNF?: boolean;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

// Seção 19: filtros para listagem de pedidos
export class FiltrosPedidoDto {
  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsEnum(StatusPedido)
  status?: StatusPedido;

  @IsOptional()
  @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;

  @IsOptional()
  @IsString()
  dataInicio?: string;

  @IsOptional()
  @IsString()
  dataFim?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  necessitaNF?: boolean;
}

class ItemSolicitacaoAlteracaoDto {
  @IsString()
  produtoId: string;

  @IsNumber()
  @Min(1)
  quantidade: number;
}

export class CriarSolicitacaoAlteracaoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitacaoAlteracaoDto)
  itens: ItemSolicitacaoAlteracaoDto[];

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class NegarSolicitacaoDto {
  @IsOptional()
  @IsString()
  resposta?: string;
}

export class FiltrosSolicitacaoDto {
  @IsOptional()
  @IsEnum(StatusSolicitacaoAlteracao)
  status?: StatusSolicitacaoAlteracao;
}

export class MarcarEntregueDto {
  @IsOptional()
  @IsString()
  recebidoPor?: string;

  @IsOptional()
  @IsString()
  observacaoEntrega?: string;

  @IsOptional()
  @IsString()
  fotoEntrega?: string;
}

export class RejeitarPedidoDto {
  @IsString()
  motivo: string;
}

export class AtribuirPedidoDto {
  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsString()
  entregadorId?: string;
}

export class AtualizarItensPedidoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens: ItemPedidoDto[];
}

export class ConfirmarEntregaMotoristaDto {
  @IsString()
  nomeRecebedor: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  fotoEntrega?: string;
}

export class CriarPedidoPortalDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoPortalDto)
  itens: ItemPedidoPortalDto[];

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;
}

class ItemPedidoPortalDto {
  @IsString()
  produtoId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantidade: number;
}
