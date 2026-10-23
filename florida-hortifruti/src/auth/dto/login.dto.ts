import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { APPS_ACESSO, type AppAcesso } from '../apps-acesso';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  senha: string;

  // App que está fazendo o login; o perfil do usuário precisa ser desse app
  @IsOptional()
  @IsIn(APPS_ACESSO)
  app?: AppAcesso;
}
