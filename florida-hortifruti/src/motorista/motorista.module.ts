import { Module } from '@nestjs/common';
import { MotoristaController } from './motorista.controller';
import { MotoristaService } from './motorista.service';
import { PrismaService } from '../prisma.service';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { StorageService } from '../common/storage.service';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [EnderecosModule, NotificacoesModule],
  controllers: [MotoristaController],
  providers: [MotoristaService, PrismaService, StorageService],
})
export class MotoristaModule {}
