import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

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

// Marcar a meta do dia como batida ou abater um valor dela, sempre com o motivo
export class AbaterMetaDto {
  @Matches(DATA, { message: 'data deve estar no formato AAAA-MM-DD' })
  data: string;

  @IsOptional()
  @IsBoolean()
  batida?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valor?: number;

  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo' })
  @MaxLength(200)
  motivo: string;
}

export class MarcarDiaSemMetaDto {
  @Matches(DATA, { message: 'data deve estar no formato AAAA-MM-DD' })
  data: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motivo?: string;
}
