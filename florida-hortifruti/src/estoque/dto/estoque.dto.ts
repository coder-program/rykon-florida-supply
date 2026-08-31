import { Transform, Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

function paraNumero(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export class EntradaEstoqueDto {
  @IsString()
  fornecedor: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorFrete?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorComissao?: number;

  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantidade?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  custoTotal?: number;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => ({
      produtoId: item?.produtoId != null ? String(item.produtoId) : '',
      quantidade: paraNumero(item?.quantidade) ?? 0,
      valorProduto: paraNumero(item?.valorProduto ?? item?.custoTotal) ?? 0,
    }));
  })
  itens?: Array<{ produtoId: string; quantidade: number; valorProduto: number }>;
}

export class AjusteEstoqueDto {
  @IsString()
  produtoId: string;

  @IsNumber()
  quantidade: number;

  @IsString()
  motivo: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
