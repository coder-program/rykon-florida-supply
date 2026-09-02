import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EnderecosController } from './enderecos.controller';
import { EnderecosService } from './enderecos.service';

@Module({
  controllers: [EnderecosController],
  providers: [EnderecosService, PrismaService],
  exports: [EnderecosService],
})
export class EnderecosModule {}
