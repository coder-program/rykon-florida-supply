import { Type } from 'class-transformer';
import { IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';

class ChavesPushDto {
  @IsString()
  @MaxLength(256)
  p256dh: string;

  @IsString()
  @MaxLength(256)
  auth: string;
}

// Formato de PushSubscription.toJSON() do navegador
export class InscricaoPushDto {
  @IsUrl({ protocols: ['https'], require_tld: false })
  @MaxLength(1024)
  endpoint: string;

  @ValidateNested()
  @Type(() => ChavesPushDto)
  keys: ChavesPushDto;
}

export class CancelarInscricaoPushDto {
  @IsString()
  @MaxLength(1024)
  endpoint: string;
}
