import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UnidadeVenda } from '@prisma/client';

export class CreateProdutoDto {
  @IsString()
  codigoInterno: string;

  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsEnum(UnidadeVenda)
  unidadeVenda?: UnidadeVenda;

  @IsNumber()
  @Min(0)
  precoSugerido: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estoqueMinimo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteEstoqueBaixo?: number;

  @IsOptional()
  @IsBoolean()
  exibirQuantidadeAproximada?: boolean;

  @IsOptional()
  @IsBoolean()
  exibirNoPortalCliente?: boolean;
}

export class UpdateProdutoDto {
  @IsOptional()
  @IsString()
  codigoInterno?: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsEnum(UnidadeVenda)
  unidadeVenda?: UnidadeVenda;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precoSugerido?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estoqueMinimo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  limiteEstoqueBaixo?: number;

  @IsOptional()
  @IsBoolean()
  exibirQuantidadeAproximada?: boolean;

  @IsOptional()
  @IsBoolean()
  exibirNoPortalCliente?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CreateCategoriaDto {
  @IsString()
  nome: string;
}

export class UpdateCategoriaDto {
  @IsString()
  nome: string;
}

export class UpsertPrecoClienteDto {
  @IsString()
  produtoId: string;

  @IsNumber()
  @Min(0)
  precoUnitario: number;
}
