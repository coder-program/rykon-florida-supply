import { Module } from '@nestjs/common';
import { MetasController } from './metas.controller';
import { MetasService } from './metas.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [MetasController],
  providers: [MetasService, PrismaService],
})
export class MetasModule {}
