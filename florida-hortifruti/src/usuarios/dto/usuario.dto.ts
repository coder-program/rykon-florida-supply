import { Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { PapelUsuario } from '@prisma/client';

export class CreateEnderecoUsuarioDto {
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() logradouro?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() complemento?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() cidadeId?: string;
  @IsOptional() @IsString() pontoReferencia?: string;
  @IsOptional() @IsBoolean() principal?: boolean;
}

export class CreateUsuarioDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  senha: string;

  @IsEnum(PapelUsuario)
  papel: PapelUsuario;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEnderecoUsuarioDto)
  endereco?: CreateEnderecoUsuarioDto;
}

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  senha?: string;

  @IsOptional()
  @IsEnum(PapelUsuario)
  papel?: PapelUsuario;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEnderecoUsuarioDto)
  endereco?: CreateEnderecoUsuarioDto;
}
