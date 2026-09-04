import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller';
import { SolicitacoesAlteracaoController } from './solicitacoes-alteracao.controller';
import { PedidosService } from './pedidos.service';
import { PrismaService } from '../prisma.service';
import { EstoqueModule } from '../estoque/estoque.module';
import { EtiquetasModule } from '../etiquetas/etiquetas.module';
import { StorageService } from '../common/storage.service';

@Module({
  imports: [EstoqueModule, EtiquetasModule],
  controllers: [PedidosController, SolicitacoesAlteracaoController],
  providers: [PedidosService, PrismaService, StorageService],
  exports: [PedidosService],
})
export class PedidosModule {}
