import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MetasService } from './metas.service';
import { AbaterMetaDto, DefinirValorMetaDto, MarcarDiaSemMetaDto } from './dto/meta.dto';

@Controller('metas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MetasController {
  constructor(private service: MetasService) {}

  // Vendedor também acompanha, mas só vê o percentual (ver MetasService.hoje)
  @Get('hoje')
  @Roles(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
    PapelUsuario.VENDEDOR,
  )
  hoje(@Request() req: any) {
    return this.service.hoje(req.user.papel);
  }

  @Get('mes')
  @Roles(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
  )
  mes(@Query('mes') mes?: string) {
    return this.service.mes(mes);
  }

  @Get('periodo')
  @Roles(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
  )
  periodo(@Query('inicio') inicio: string, @Query('fim') fim: string) {
    return this.service.periodo(inicio, fim);
  }

  @Get('valores')
  @Roles(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
  )
  valores() {
    return this.service.valores();
  }

  @Post('valores')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO, PapelUsuario.SUPERVISOR)
  definirValor(@Body() dto: DefinirValorMetaDto, @Request() req: any) {
    return this.service.definirValor(dto, req.user.id);
  }

  @Delete('valores/:id')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO, PapelUsuario.SUPERVISOR)
  removerValor(@Param('id') id: string) {
    return this.service.removerValor(id);
  }

  @Get('dias-sem-meta')
  @Roles(
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
  )
  diasSemMeta(@Query('mes') mes?: string) {
    return this.service.diasSemMeta(mes);
  }

  @Post('dias-sem-meta')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO, PapelUsuario.SUPERVISOR)
  marcarDiaSemMeta(@Body() dto: MarcarDiaSemMetaDto) {
    return this.service.marcarDiaSemMeta(dto);
  }

  @Delete('dias-sem-meta/:data')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO, PapelUsuario.SUPERVISOR)
  desmarcarDiaSemMeta(@Param('data') data: string) {
    return this.service.desmarcarDiaSemMeta(data);
  }

  // Abatimento (marcar como batida ou abater um valor): só administrador e financeiro
  @Post('abatimentos')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  abater(@Body() dto: AbaterMetaDto, @Request() req: any) {
    return this.service.abater(dto, req.user.id);
  }

  @Delete('abatimentos/:data')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  removerAbatimento(@Param('data') data: string, @Request() req: any) {
    return this.service.removerAbatimento(data, req.user.id);
  }
}
