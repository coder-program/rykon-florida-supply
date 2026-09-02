import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocalidadesService } from './localidades.service';

@Controller('localidades')
@UseGuards(JwtAuthGuard)
export class LocalidadesController {
  constructor(private readonly localidadesService: LocalidadesService) {}

  @Get('estados')
  findEstados() {
    return this.localidadesService.findEstados();
  }

  @Get('estados/:estadoId/cidades')
  findCidadesPorEstado(@Param('estadoId') estadoId: string) {
    return this.localidadesService.findCidadesPorEstado(estadoId);
  }
}
