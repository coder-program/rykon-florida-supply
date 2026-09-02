import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateEnderecoDto {
  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  logradouro?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsString()
  cidadeId: string;

  @IsOptional()
  @IsString()
  pontoReferencia?: string;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;

  @IsOptional()
  @IsString()
  tipo?: string;
}

export class UpdateEnderecoDto {
  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  logradouro?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  complemento?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cidadeId?: string;

  @IsOptional()
  @IsString()
  pontoReferencia?: string;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;

  @IsOptional()
  @IsString()
  tipo?: string;
}
