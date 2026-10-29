import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class SalvarInvestimentoDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe quem fez o aporte' })
  nome: string;

  // YYYY-MM-DD
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data do aporte inválida' })
  data: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Valor inválido' })
  @Min(0.01, { message: 'Informe o valor do aporte' })
  valor: number;

  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do aporte' })
  motivo: string;
}

export class RegistrarDevolucaoInvestimentoDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Valor inválido' })
  @Min(0.01, { message: 'Informe o valor devolvido' })
  valor: number;

  // YYYY-MM-DD
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data da devolução inválida' })
  data: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
