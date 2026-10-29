import { Module } from '@nestjs/common';
import { EntregasController } from './entregas.controller';
import { EntregasService } from './entregas.service';
import { PrismaService } from '../prisma.service';
import { GeocodificacaoService } from '../common/geocodificacao.service';

@Module({
  controllers: [EntregasController],
  providers: [EntregasService, PrismaService, GeocodificacaoService],
})
export class EntregasModule {}
