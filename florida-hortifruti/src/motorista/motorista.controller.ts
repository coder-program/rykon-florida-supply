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
import { ConfirmarEntregaMotoristaDto } from '../pedidos/dto/pedido.dto';

@Controller('motorista/entregas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.MOTORISTA)
export class MotoristaController {
  constructor(private motoristaService: MotoristaService) {}

  @Get()
  listar(@Request() req: any) {
    return this.motoristaService.listar(req.user.id);
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
