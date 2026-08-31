import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemEntradaEstoqueDto {
  @IsString()
  produtoId: string;

  @IsNumber()
  @Min(0.01)
  quantidade: number;

  @IsNumber()
  @Min(0)
  valorProduto: number;
}

export class EntradaEstoqueDto {
  @IsString()
  fornecedor: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorFrete?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorComissao?: number;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemEntradaEstoqueDto)
  itens: ItemEntradaEstoqueDto[];
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
