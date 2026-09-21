import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FormaPagamento } from '@prisma/client';

export class RegistrarPagamentoDto {
  @IsNumber()
  @Min(0.01)
  valor: number;

  @IsOptional()
  @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;

  @IsOptional()
  @IsString()
  observacao?: string;
}
