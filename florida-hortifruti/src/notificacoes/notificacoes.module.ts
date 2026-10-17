import { Module } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [NotificacoesService, PrismaService],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
