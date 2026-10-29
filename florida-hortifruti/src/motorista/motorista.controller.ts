import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MotoristaService } from './motorista.service';
import { ConfirmarEntregaMotoristaDto, ScanEtiquetaDto } from '../pedidos/dto/pedido.dto';
import { LocalizacaoMotoristaDto } from './dto/localizacao.dto';

@Controller('motorista/entregas')
@UseGuards(JwtAuthGuard, RolesGuard)
// Supervisor às vezes faz entregas: vê só as atribuídas a ele, como o motorista
@Roles(PapelUsuario.MOTORISTA, PapelUsuario.SUPERVISOR)
export class MotoristaController {
  constructor(private motoristaService: MotoristaService) {}

  @Get()
  listar(@Request() req: any) {
    return this.motoristaService.listar(req.user.id);
  }

  // Posição do celular enquanto o app está aberto (acompanhamento das entregas no painel)
  @Post('localizacao')
  localizacao(@Body() dto: LocalizacaoMotoristaDto, @Request() req: any) {
    return this.motoristaService.registrarLocalizacao(req.user.id, dto);
  }

  // Leitura do QR Code da etiqueta pela câmera do celular -> avança para "a caminho" (EM_ENTREGA)
  @Post('scan')
  scan(@Body() dto: ScanEtiquetaDto, @Request() req: any) {
    return this.motoristaService.iniciarPorToken(dto.token, req.user.id);
  }

  @Get(':id')
  detalhe(@Param('id') id: string, @Request() req: any) {
    return this.motoristaService.detalhe(id, req.user.id);
  }

  @Post(':id/iniciar')
  iniciar(@Param('id') id: string, @Request() req: any) {
    return this.motoristaService.iniciar(id, req.user.id);
  }

  @Post(':id/confirmar')
  @UseInterceptors(FileInterceptor('foto'))
  confirmar(
    @Param('id') id: string,
    @Body() dto: ConfirmarEntregaMotoristaDto,
    @UploadedFile() file: { buffer: Buffer; mimetype?: string } | undefined,
    @Request() req: any,
  ) {
    return this.motoristaService.confirmar(id, req.user.id, dto, file);
  }
}
