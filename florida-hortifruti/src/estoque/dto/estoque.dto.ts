import { Transform, Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

function paraNumero(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export class EntradaEstoqueDto {
  // Fornecedor do cadastro; o nome solto só é usado quando não vem fornecedorId
  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  fornecedor?: string;

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
      numeroLote: item?.numeroLote != null ? String(item.numeroLote) : undefined,
      precoSugeridoVenda: paraNumero(item?.precoSugeridoVenda),
    }));
  })
  itens?: Array<{
    produtoId: string;
    quantidade: number;
    valorProduto: number;
    numeroLote?: string;
    precoSugeridoVenda?: number;
  }>;

  // Lote da compra (ex.: 18/09 - lote 1). Vazio = próximo número do dia
  @IsOptional()
  @IsString()
  numeroLote?: string;

  // Data do lote no formato YYYY-MM-DD. Vazio = hoje
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data do lote inválida' })
  dataLote?: string;
}

// Editar uma entrada já registrada: frete e comissão costumam ser pagos depois,
// às vezes com o lote já vendido. Quantidade não muda aqui (para isso existe o ajuste).
export class AtualizarCompraDto {
  @IsOptional()
  @IsString()
  fornecedorId?: string;

  @IsOptional()
  @IsString()
  fornecedor?: string;

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
  observacao?: string;

  // Valor do produto por caixa de cada item da compra
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => ({
      id: item?.id != null ? String(item.id) : '',
      valorProduto: paraNumero(item?.valorProduto),
    }));
  })
  itens?: Array<{ id: string; valorProduto?: number }>;
}

export class AtualizarLoteDto {
  @IsOptional()
  @IsString()
  numero?: string;

  // null limpa o preço sugerido
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === null || value === '' ? null : Number(value),
  )
  @IsNumber({}, { message: 'Preço sugerido inválido' })
  @Min(0)
  precoSugeridoVenda?: number | null;

  @IsOptional()
  @IsString()
  observacao?: string;
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

  // Lote que recebe (ajuste positivo) ou perde (negativo) as caixas
  @IsOptional()
  @IsString()
  loteId?: string;
}
