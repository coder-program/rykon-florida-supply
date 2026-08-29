import { IsString, IsOptional, IsBoolean, IsEmail } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  razaoSocialOuNome: string;

  @IsOptional() @IsString()
  nomeFantasia?: string;

  @IsString()
  cnpjCpf: string;

  @IsOptional() @IsString()
  telefone?: string;

  @IsOptional() @IsString()
  whatsapp?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  endereco?: string;

  @IsOptional() @IsString()
  cidade?: string;

  @IsOptional() @IsString()
  estado?: string;

  @IsOptional() @IsString()
  responsavelContato?: string;

  @IsOptional() @IsString()
  condicaoPagamento?: string;

  @IsOptional() @IsString()
  formaPagamentoUsual?: string;

  @IsOptional() @IsBoolean()
  necessitaNF?: boolean;

  @IsOptional() @IsString()
  observacoes?: string;
}

export class UpdateClienteDto extends CreateClienteDto {}
