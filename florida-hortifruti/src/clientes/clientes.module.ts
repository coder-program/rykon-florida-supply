import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma.service';
import { EnderecosModule } from '../enderecos/enderecos.module';

@Module({
  imports: [EnderecosModule],
  controllers: [ClientesController],
  providers: [ClientesService, PrismaService],
})
export class ClientesModule {}
