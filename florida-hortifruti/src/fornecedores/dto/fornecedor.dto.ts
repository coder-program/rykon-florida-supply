import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFornecedorDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do fornecedor' })
  nome: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class UpdateFornecedorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do fornecedor' })
  nome?: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
