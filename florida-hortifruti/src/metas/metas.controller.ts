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
import { DefinirValorMetaDto, MarcarDiaSemMetaDto } from './dto/meta.dto';

@Controller('metas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MetasController {
  constructor(private service: MetasService) {}

  // Vendedor também acompanha, mas só vê o percentual (ver MetasService.hoje)
  @Get('hoje')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO, PapelUsuario.VENDEDOR)
  hoje(@Request() req: any) {
    return this.service.hoje(req.user.papel);
  }

  @Get('mes')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  mes(@Query('mes') mes?: string) {
    return this.service.mes(mes);
  }

  @Get('valores')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  valores() {
    return this.service.valores();
  }

  @Post('valores')
  @Roles(PapelUsuario.ADMINISTRADOR)
  definirValor(@Body() dto: DefinirValorMetaDto, @Request() req: any) {
    return this.service.definirValor(dto, req.user.id);
  }

  @Delete('valores/:id')
  @Roles(PapelUsuario.ADMINISTRADOR)
  removerValor(@Param('id') id: string) {
    return this.service.removerValor(id);
  }

  @Get('dias-sem-meta')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  diasSemMeta(@Query('mes') mes?: string) {
    return this.service.diasSemMeta(mes);
  }

  @Post('dias-sem-meta')
  @Roles(PapelUsuario.ADMINISTRADOR)
  marcarDiaSemMeta(@Body() dto: MarcarDiaSemMetaDto) {
    return this.service.marcarDiaSemMeta(dto);
  }

  @Delete('dias-sem-meta/:data')
  @Roles(PapelUsuario.ADMINISTRADOR)
  desmarcarDiaSemMeta(@Param('data') data: string) {
    return this.service.desmarcarDiaSemMeta(data);
  }
}
