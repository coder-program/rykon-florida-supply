import { Module } from '@nestjs/common';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProdutosController],
  providers: [ProdutosService, PrismaService],
})
export class ProdutosModule {}
