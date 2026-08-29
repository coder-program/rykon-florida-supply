import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EtiquetasController } from './etiquetas.controller';
import { EtiquetasService } from './etiquetas.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [EtiquetasController],
  providers: [EtiquetasService, PrismaService],
  exports: [EtiquetasService],
})
export class EtiquetasModule {}
