import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsPhoneNumber,
  Length,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

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

function isValidCnpj(digits: string) {
  if (!/^\d{14}$/.test(digits) || /^([0-9])\1{13}$/.test(digits)) return false;

  const calc = (base: number[], weights: number[]) => {
    const sum = base.reduce((acc, digit, index) => acc + digit * weights[index], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const numbers = digits.split('').map(Number);
  const first = calc(numbers.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(numbers.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === numbers[12] && second === numbers[13];
}

@ValidatorConstraint({ name: 'isCpfCnpjValido', async: false })
class CpfCnpjValidoConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;

    const digits = onlyDigits(value);
    return digits.length === 11
      ? isValidCpf(digits)
      : digits.length === 14
        ? isValidCnpj(digits)
        : false;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} inválido`;
  }
}

function Trimmed() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}

export class CreateClienteDto {
  @Trimmed()
  @IsString()
  @Length(3, 120)
  @Matches(/^[\p{L}\p{N} .,'&()\/-]+$/u, {
    message: 'Nome ou razão social pode conter apenas letras, números e sinais básicos',
  })
  razaoSocialOuNome: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @Trimmed()
  @Validate(CpfCnpjValidoConstraint)
  cnpjCpf?: string;

  @Trimmed()
  @IsPhoneNumber('BR', { message: 'Telefone inválido' })
  telefone: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  responsavelContato?: string;

  @IsOptional()
  @IsString()
  condicaoPagamento?: string;

  @IsOptional()
  @IsString()
  formaPagamentoUsual?: string;

  @IsOptional()
  @IsBoolean()
  necessitaNF?: boolean;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class UpdateClienteDto {
  @IsOptional()
  @Trimmed()
  @IsString()
  @Length(3, 120)
  @Matches(/^[\p{L}\p{N} .,'&()\/-]+$/u, {
    message: 'Nome ou razão social pode conter apenas letras, números e sinais básicos',
  })
  razaoSocialOuNome?: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @Trimmed()
  @Validate(CpfCnpjValidoConstraint)
  cnpjCpf?: string;

  @IsOptional()
  @Trimmed()
  @IsPhoneNumber('BR', { message: 'Telefone inválido' })
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  responsavelContato?: string;

  @IsOptional()
  @IsString()
  condicaoPagamento?: string;

  @IsOptional()
  @IsString()
  formaPagamentoUsual?: string;

  @IsOptional()
  @IsBoolean()
  necessitaNF?: boolean;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
