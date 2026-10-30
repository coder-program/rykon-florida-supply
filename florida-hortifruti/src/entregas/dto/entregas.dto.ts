import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class OrdemRotaDto {
  // Pedidos do mesmo entregador, na ordem em que devem ser entregues
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  pedidoIds: string[];
}

export class ProblemaEntregaDto {
  @IsString()
  @IsNotEmpty({ message: 'Descreva o problema da entrega' })
  descricao: string;
}

export class DataPrevistaDto {
  // YYYY-MM-DD; vazio limpa a data
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'Data prevista inválida' })
  dataPrevista?: string;
}
