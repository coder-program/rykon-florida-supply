import { Module } from '@nestjs/common';
import { PortalClienteController } from './portal-cliente.controller';
import { PortalClienteService } from './portal-cliente.service';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { ClientesModule } from '../clientes/clientes.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [PedidosModule, ProdutosModule, EnderecosModule, ClientesModule],
  controllers: [PortalClienteController],
  providers: [PortalClienteService, PrismaService],
})
export class PortalClienteModule {}
