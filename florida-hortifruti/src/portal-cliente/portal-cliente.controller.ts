import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PortalClienteService } from './portal-cliente.service';
import { CriarPedidoPortalDto } from '../pedidos/dto/pedido.dto';

@Controller('portal-cliente')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.CLIENTE)
export class PortalClienteController {
  constructor(private portal: PortalClienteService) {}

  @Get('produtos')
  produtos(@Request() req: any) {
    return this.portal.catalogo(req.user.id);
  }

  @Get('pedidos')
  pedidos(@Request() req: any) {
    return this.portal.listarPedidos(req.user.id);
  }

  @Get('pedidos/:id')
  detalhe(@Param('id') id: string, @Request() req: any) {
    return this.portal.detalhe(id, req.user.id);
  }

  @Post('pedidos')
  criar(@Body() dto: CriarPedidoPortalDto, @Request() req: any) {
    return this.portal.criarPedido(req.user.id, dto);
  }

  @Put('pedidos/:id')
  atualizar(@Param('id') id: string, @Body() dto: CriarPedidoPortalDto, @Request() req: any) {
    return this.portal.atualizarPedido(id, req.user.id, dto);
  }

  @Get('conta')
  conta(@Request() req: any) {
    return this.portal.conta(req.user.id);
  }
}
