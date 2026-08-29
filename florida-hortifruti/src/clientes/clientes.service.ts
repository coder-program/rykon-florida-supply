import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateClienteDto) {
    return this.prisma.cliente.create({ data: dto });
  }

  findAll() {
    return this.prisma.cliente.findMany({ where: { ativo: true } });
  }

  // Item 4 do escopo: pesquisa por nome, CNPJ/CPF ou telefone
  async search(termo: string) {
    return this.prisma.cliente.findMany({
      where: {
        ativo: true,
        OR: [
          { razaoSocialOuNome: { contains: termo, mode: 'insensitive' } },
          { nomeFantasia: { contains: termo, mode: 'insensitive' } },
          { cnpjCpf: { contains: termo } },
          { telefone: { contains: termo } },
        ],
      },
    });
  }

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.findOne(id);
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  // Não removemos de verdade (regra 6/8 do escopo: nada some sem histórico)
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cliente.update({ where: { id }, data: { ativo: false } });
  }
}
