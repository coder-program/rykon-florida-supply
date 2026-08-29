import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PapelUsuario, StatusPedido } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto, UpdatePedidoDto, FiltrosPedidoDto } from './dto/pedido.dto';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedidosController {
  constructor(private pedidosService: PedidosService) {}

  @Post()
  create(@Body() dto: CreatePedidoDto, @Request() req: any) {
    return this.pedidosService.create(dto, req.user.id);
  }

  // Seção 3.1: vendedor só vê os próprios pedidos. Admin/Financeiro vê todos com filtros.
  @Get()
  findAll(@Query() filtros: FiltrosPedidoDto, @Request() req: any) {
    return this.pedidosService.findAll(filtros, req.user.id, req.user.papel);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pedidosService.findOne(id);
  }

  // Seção 3.2: editar pedido antes de aprovar
  @Patch(':id')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  atualizar(@Param('id') id: string, @Body() dto: UpdatePedidoDto, @Request() req: any) {
    return this.pedidosService.atualizar(id, dto, req.user.id);
  }

  // Seção 3.2: só administrativo/administrador aprova pedidos
  @Post(':id/aprovar')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  aprovar(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.aprovar(id, req.user.id);
  }

  // Seção 13: transições de status pela equipe administrativa
  @Post(':id/separacao')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  separacao(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.atualizarStatus(id, StatusPedido.SEPARACAO_ENTREGA, req.user.id);
  }

  @Post(':id/entregue')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  entregue(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.atualizarStatus(id, StatusPedido.ENTREGUE, req.user.id);
  }

  @Post(':id/faturado')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  faturado(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.atualizarStatus(id, StatusPedido.FATURADO, req.user.id);
  }

  @Post(':id/pago')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  pago(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.atualizarStatus(id, StatusPedido.PAGO, req.user.id);
  }

  @Post(':id/cancelar')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  cancelar(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.cancelar(id, req.user.id);
  }
}
