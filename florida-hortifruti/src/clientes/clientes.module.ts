import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma.service';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { ProdutosModule } from '../produtos/produtos.module';

@Module({
  imports: [EnderecosModule, ProdutosModule],
  controllers: [ClientesController],
  providers: [ClientesService, PrismaService],
  exports: [ClientesService],
})
export class ClientesModule {}
