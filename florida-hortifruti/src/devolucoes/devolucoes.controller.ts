import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DevolucoesService } from './devolucoes.service';
import { AtualizarStatusDevolucaoDto, CriarDevolucaoDto } from './dto/devolucao.dto';

@Controller('devolucoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevolucoesController {
  constructor(private service: DevolucoesService) {}

  @Post()
  @Roles(PapelUsuario.VENDEDOR)
  criar(@Body() dto: CriarDevolucaoDto, @Request() req: any) {
    return this.service.criar(dto, req.user.id, req.user.papel);
  }

  @Get('minhas')
  @Roles(PapelUsuario.VENDEDOR)
  listarMinhas(@Request() req: any) {
    return this.service.listarMinhas(req.user.id);
  }

  @Get('etiqueta/:token')
  @Roles(PapelUsuario.VENDEDOR)
  buscarPedidoPorEtiqueta(@Param('token') token: string, @Request() req: any) {
    return this.service.buscarPedidoPorEtiqueta(token, req.user.id, req.user.papel);
  }

  @Get()
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  listarTodas() {
    return this.service.listarTodas();
  }

  @Patch(':id/status')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  atualizarStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: AtualizarStatusDevolucaoDto,
  ) {
    return this.service.atualizarStatus(id, dto, req.user.id);
  }

  @Get('resumo')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  resumo(@Query() query: Record<string, string | undefined>) {
    return this.service.resumo({ dataInicio: query?.dataInicio, dataFim: query?.dataFim });
  }
}
