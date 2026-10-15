import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export class DefinirValorMetaDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor: number;

  // Data a partir da qual o valor vale (YYYY-MM-DD). Sem data = a partir de hoje.
  @IsOptional()
  @Matches(DATA, { message: 'vigenteDesde deve estar no formato AAAA-MM-DD' })
  vigenteDesde?: string;
}

export class MarcarDiaSemMetaDto {
  @Matches(DATA, { message: 'data deve estar no formato AAAA-MM-DD' })
  data: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motivo?: string;
}
