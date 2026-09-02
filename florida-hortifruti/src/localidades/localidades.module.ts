import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LocalidadesController } from './localidades.controller';
import { LocalidadesService } from './localidades.service';

@Module({
  controllers: [LocalidadesController],
  providers: [LocalidadesService, PrismaService],
  exports: [LocalidadesService],
})
export class LocalidadesModule {}
