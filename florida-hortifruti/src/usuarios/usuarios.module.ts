import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { PrismaService } from '../prisma.service';
import { EnderecosModule } from '../enderecos/enderecos.module';

@Module({
  imports: [EnderecosModule],
  providers: [UsuariosService, PrismaService],
  controllers: [UsuariosController],
  exports: [UsuariosService],
})
export class UsuariosModule {}
