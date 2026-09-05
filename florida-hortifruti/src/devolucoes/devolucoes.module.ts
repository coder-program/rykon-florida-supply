import { Module } from '@nestjs/common';
import { DevolucoesController } from './devolucoes.controller';
import { DevolucoesService } from './devolucoes.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../common/storage.service';

@Module({
  controllers: [DevolucoesController],
  providers: [DevolucoesService, PrismaService, StorageService],
})
export class DevolucoesModule {}
