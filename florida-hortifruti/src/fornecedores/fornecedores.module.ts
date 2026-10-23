import { Module } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FornecedoresController],
  providers: [FornecedoresService, PrismaService],
})
export class FornecedoresModule {}
