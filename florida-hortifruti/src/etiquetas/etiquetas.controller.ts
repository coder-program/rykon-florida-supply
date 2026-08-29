import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EtiquetasService } from './etiquetas.service';

@Controller()
export class EtiquetasController {
  constructor(private etiquetasService: EtiquetasService) {}

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
