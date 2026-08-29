import { IsString, IsEmail, IsEnum, IsOptional, MinLength } from 'class-validator';
import { PapelUsuario } from '@prisma/client';

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
}

export class UpdateUsuarioDto {
  @IsOptional() @IsString()
  nome?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MinLength(6)
  senha?: string;

  @IsOptional() @IsEnum(PapelUsuario)
  papel?: PapelUsuario;
}
