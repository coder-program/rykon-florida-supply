import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class OrdemRotaDto {
  // Pedidos do mesmo entregador, na ordem em que devem ser entregues
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  pedidoIds: string[];
}
