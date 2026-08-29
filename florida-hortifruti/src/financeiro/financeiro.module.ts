import { Module } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroController } from './financeiro.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FinanceiroController],
  providers: [FinanceiroService, PrismaService],
})
export class FinanceiroModule {}
