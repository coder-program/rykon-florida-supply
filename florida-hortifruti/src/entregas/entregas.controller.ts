import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EntregasService } from './entregas.service';
import { OrdemRotaDto } from './dto/entregas.dto';

// Acompanhamento das rotas dos motoristas (painel): supervisor e financeiro/administração
@Controller('entregas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.SUPERVISOR, PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
export class EntregasController {
  constructor(private service: EntregasService) {}

  @Get('acompanhamento')
  acompanhamento() {
    return this.service.acompanhamento();
  }

  @Put('ordem')
  definirOrdem(@Body() dto: OrdemRotaDto) {
    return this.service.definirOrdem(dto.pedidoIds);
  }
}
