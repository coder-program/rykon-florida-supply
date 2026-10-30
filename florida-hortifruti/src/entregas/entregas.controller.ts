import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EntregasService } from './entregas.service';
import { DataPrevistaDto, OrdemRotaDto, ProblemaEntregaDto } from './dto/entregas.dto';

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

  // Aba Entregas do Dashboard; a TV (Visão geral) só acompanha
  @Get('painel')
  @Roles(
    PapelUsuario.SUPERVISOR,
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.VISAO_GERAL,
  )
  painel(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.service.painel(dataInicio, dataFim);
  }

  @Put(':id/data-prevista')
  definirDataPrevista(@Param('id') id: string, @Body() dto: DataPrevistaDto) {
    return this.service.definirDataPrevista(id, dto.dataPrevista);
  }

  @Put(':id/problema')
  registrarProblema(@Param('id') id: string, @Body() dto: ProblemaEntregaDto, @Request() req: any) {
    return this.service.registrarProblema(id, dto.descricao, req.user.id);
  }

  @Delete(':id/problema')
  resolverProblema(@Param('id') id: string, @Request() req: any) {
    return this.service.resolverProblema(id, req.user.id);
  }
}
