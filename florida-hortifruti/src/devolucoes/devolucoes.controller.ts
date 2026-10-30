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
import {
  AtualizarStatusDevolucaoDto,
  CriarDevolucaoDto,
  RegistrarReembolsoDto,
} from './dto/devolucao.dto';

const QUEM_REGISTRA = [
  PapelUsuario.VENDEDOR,
  PapelUsuario.SUPERVISOR,
  PapelUsuario.MOTORISTA,
  PapelUsuario.REVENDEDOR,
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.ADMINISTRATIVO,
];

@Controller('devolucoes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevolucoesController {
  constructor(private service: DevolucoesService) {}

  @Post()
  @Roles(...QUEM_REGISTRA)
  criar(@Body() dto: CriarDevolucaoDto, @Request() req: any) {
    return this.service.criar(dto, req.user.id, req.user.papel);
  }

  @Get('minhas')
  @Roles(...QUEM_REGISTRA)
  listarMinhas(@Request() req: any) {
    return this.service.listarMinhas(req.user.id);
  }

  // Histórico de pedidos entregues do usuário, para escolher qual teve devolução
  @Get('pedidos')
  @Roles(...QUEM_REGISTRA)
  listarPedidos(@Request() req: any) {
    return this.service.listarPedidosParaDevolucao(req.user.id, req.user.papel);
  }

  @Get('etiqueta/:token')
  @Roles(...QUEM_REGISTRA)
  buscarPedidoPorEtiqueta(@Param('token') token: string, @Request() req: any) {
    return this.service.buscarPedidoPorEtiqueta(token, req.user.id, req.user.papel);
  }

  @Get()
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR, PapelUsuario.SUPERVISOR)
  listarTodas() {
    return this.service.listarTodas();
  }

  @Patch(':id/status')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR, PapelUsuario.SUPERVISOR)
  atualizarStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: AtualizarStatusDevolucaoDto,
  ) {
    return this.service.atualizarStatus(id, dto, req.user.id);
  }

  // Separado da aprovação: o reembolso pode ser feito dias depois
  @Patch(':id/reembolso')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR, PapelUsuario.SUPERVISOR)
  registrarReembolso(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: RegistrarReembolsoDto,
  ) {
    return this.service.registrarReembolso(id, dto, req.user.id);
  }

  // Card de Perdas do Dashboard
  @Get('perdas')
  @Roles(
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
  )
  perdas(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.service.perdas(dataInicio, dataFim);
  }

  @Get('resumo')
  @Roles(
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
  )
  resumo(@Query() query: Record<string, string | undefined>) {
    return this.service.resumo({ dataInicio: query?.dataInicio, dataFim: query?.dataFim });
  }
}
