import { Controller, Get, Param } from '@nestjs/common';
import { LocalidadesService } from './localidades.service';

@Controller('localidades')
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
