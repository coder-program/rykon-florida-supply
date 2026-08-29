import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateProdutoDto {
  @IsString()
  codigoInterno: string;

  @IsString()
  nome: string;

  @IsOptional() @IsString()
  categoria?: string;

  @IsOptional() @IsString()
  unidadeVenda?: string;

  @IsNumber() @Min(0)
  precoSugerido: number;

  @IsOptional() @IsNumber() @Min(0)
  custo?: number;

  @IsOptional() @IsNumber() @Min(0)
  estoqueMinimo?: number;
}

export class UpdateProdutoDto {
  @IsOptional() @IsString()
  nome?: string;

  @IsOptional() @IsString()
  categoria?: string;

  @IsOptional() @IsNumber() @Min(0)
  precoSugerido?: number;

  @IsOptional() @IsNumber() @Min(0)
  custo?: number;

  @IsOptional() @IsNumber() @Min(0)
  estoqueMinimo?: number;

  @IsOptional() @IsBoolean()
  ativo?: boolean;
}
