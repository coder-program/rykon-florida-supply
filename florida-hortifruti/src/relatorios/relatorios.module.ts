import { Module } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosController } from './relatorios.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [RelatoriosService, PrismaService],
  controllers: [RelatoriosController],
})
export class RelatoriosModule {}
