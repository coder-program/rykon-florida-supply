import { Module } from '@nestjs/common';
import { DevolucoesController } from './devolucoes.controller';
import { DevolucoesService } from './devolucoes.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../common/storage.service';
import { EstoqueModule } from '../estoque/estoque.module';

@Module({
  imports: [EstoqueModule],
  controllers: [DevolucoesController],
  providers: [DevolucoesService, PrismaService, StorageService],
})
export class DevolucoesModule {}
