import { Module } from '@nestjs/common';
import { CategoriasController, ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProdutosController, CategoriasController],
  providers: [ProdutosService, PrismaService],
  exports: [ProdutosService],
})
export class ProdutosModule {}
