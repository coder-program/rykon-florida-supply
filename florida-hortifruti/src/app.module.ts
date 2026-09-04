import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProdutosModule } from './produtos/produtos.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { EstoqueModule } from './estoque/estoque.module';
import { EtiquetasModule } from './etiquetas/etiquetas.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { LocalidadesModule } from './localidades/localidades.module';
import { EnderecosModule } from './enderecos/enderecos.module';
import { MotoristaModule } from './motorista/motorista.module';
import { PortalClienteModule } from './portal-cliente/portal-cliente.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsuariosModule,
    ClientesModule,
    ProdutosModule,
    PedidosModule,
    EstoqueModule,
    EtiquetasModule,
    RelatoriosModule,
    FinanceiroModule,
    LocalidadesModule,
    EnderecosModule,
    MotoristaModule,
    PortalClienteModule,
  ],
})
export class AppModule {}
