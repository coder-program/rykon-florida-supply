import { IsString, MinLength } from 'class-validator';

export class DefinirSenhaDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  senha: string;
}
