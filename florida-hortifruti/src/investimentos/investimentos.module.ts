import { Module } from '@nestjs/common';
import { InvestimentosController } from './investimentos.controller';
import { InvestimentosService } from './investimentos.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [InvestimentosController],
  providers: [InvestimentosService, PrismaService],
})
export class InvestimentosModule {}
