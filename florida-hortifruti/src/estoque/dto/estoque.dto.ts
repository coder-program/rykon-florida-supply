import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class EntradaEstoqueDto {
  @IsString()
  produtoId: string;

  @IsNumber()
  @Min(0.01)
  quantidade: number;

  @IsString()
  fornecedor: string;

  @IsNumber()
  @Min(0)
  custoTotal: number;

  @IsOptional() @IsString()
  observacao?: string;
}

export class AjusteEstoqueDto {
  @IsString()
  produtoId: string;

  @IsNumber()
  quantidade: number; // positivo = entrada, negativo = saída

  @IsString()
  motivo: string; // ex: 'Perda', 'Avaria', 'Contagem física', 'Ajuste inicial'

  @IsOptional() @IsString()
  observacao?: string;
}
