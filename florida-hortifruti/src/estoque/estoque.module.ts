import { Module } from '@nestjs/common';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EstoqueController],
  providers: [EstoqueService, PrismaService],
  exports: [EstoqueService], // usado pelo módulo de Pedidos ao aprovar
})
export class EstoqueModule {}
