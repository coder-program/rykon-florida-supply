import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LocalidadesService {
  constructor(private prisma: PrismaService) {}

  findEstados() {
    return this.prisma.estado.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, sigla: true },
    });
  }

  async findCidadesPorEstado(estadoId: string) {
    const estado = await this.prisma.estado.findUnique({ where: { id: estadoId } });
    if (!estado) throw new NotFoundException('Estado não encontrado');

    return this.prisma.cidade.findMany({
      where: { estadoId },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, estadoId: true },
    });
  }
}
