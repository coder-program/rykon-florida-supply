import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  ValidateNested,
  IsBoolean,
  IsDateString,
  IsPhoneNumber,
  Length,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { PapelUsuario } from '@prisma/client';

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function isValidCpf(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^([0-9])\1{10}$/.test(digits)) return false;

  const calc = (limit: number) => {
    let sum = 0;
    for (let i = 0; i < limit; i += 1) sum += Number(digits[i]) * (limit + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function Trimmed() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}

@ValidatorConstraint({ name: 'isCpfValido', async: false })
class CpfValidoConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    return isValidCpf(onlyDigits(value));
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} inválido`;
  }
}

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
  @Trimmed()
  @IsString()
  @Length(3, 120)
  @Matches(/^[\p{L}\p{N} .,'&()\/-]+$/u, {
    message: 'Nome pode conter apenas letras, números e sinais básicos',
  })
  nome: string;

  @Trimmed()
  @IsEmail()
  email: string;

  @IsOptional()
  @Trimmed()
  @Validate(CpfValidoConstraint)
  cpf?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  dataNascimento?: string;

  @IsOptional()
  @Trimmed()
  @IsPhoneNumber('BR', { message: 'Telefone inválido' })
  telefone?: string;

  @IsOptional()
  @Trimmed()
  @IsPhoneNumber('BR', { message: 'WhatsApp inválido' })
  whatsapp?: string;

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
  @Trimmed()
  @IsString()
  @Length(3, 120)
  @Matches(/^[\p{L}\p{N} .,'&()\/-]+$/u, {
    message: 'Nome pode conter apenas letras, números e sinais básicos',
  })
  nome?: string;

  @IsOptional()
  @Trimmed()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Trimmed()
  @Validate(CpfValidoConstraint)
  cpf?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento inválida' })
  dataNascimento?: string;

  @IsOptional()
  @Trimmed()
  @IsPhoneNumber('BR', { message: 'Telefone inválido' })
  telefone?: string;

  @IsOptional()
  @Trimmed()
  @IsPhoneNumber('BR', { message: 'WhatsApp inválido' })
  whatsapp?: string;

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
