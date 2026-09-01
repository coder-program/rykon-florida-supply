import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EtiquetasService } from './etiquetas.service';

@Controller()
export class EtiquetasController {
  constructor(private etiquetasService: EtiquetasService) {}

  @Post('etiquetas/pedido/:pedidoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  garantirParaPedido(@Param('pedidoId') pedidoId: string) {
    return this.etiquetasService.garantirParaPedido(pedidoId);
  }

  // Dados completos para impressão da etiqueta (autenticado)
  @Get('etiquetas/:id')
  @UseGuards(JwtAuthGuard)
  buscarCompleto(@Param('id') id: string) {
    return this.etiquetasService.buscarCompleto(id);
  }

  @Get('etiquetas/:id/qrcode')
  @UseGuards(JwtAuthGuard)
  gerarQRCode(@Param('id') id: string) {
    return this.etiquetasService.gerarQRCode(id);
  }

  @Post('etiquetas/:id/reimprimir')
  @UseGuards(JwtAuthGuard)
  reimprimir(@Param('id') id: string) {
    return this.etiquetasService.marcarReimpressao(id);
  }

  // Rota PÚBLICA — é para onde o QR Code aponta, sem necessidade de login (item 34.2)
  @Get('p/:token')
  paginaPublica(@Param('token') token: string) {
    return this.etiquetasService.buscarPorToken(token);
  }
}
