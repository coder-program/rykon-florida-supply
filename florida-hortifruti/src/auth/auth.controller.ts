import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { DefinirSenhaDto } from './dto/definir-senha.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.senha);
  }

  @Post('definir-senha')
  @HttpCode(200)
  definirSenha(@Body() dto: DefinirSenhaDto) {
    return this.authService.definirSenha(dto.token, dto.senha);
  }
}
