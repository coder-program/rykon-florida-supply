import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoEntidadeEndereco } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    private prisma: PrismaService,
    private enderecosService: EnderecosService,
  ) {}

  private async criarOuAtualizarEnderecoCliente(clienteId: string, dto: Partial<any> | undefined) {
    if (!dto || (!dto.cidadeId && !dto.logradouro && !dto.endereco)) return;

    const enderecoPayload = dto.endereco ?? dto;
    if (!enderecoPayload?.cidadeId && !enderecoPayload?.logradouro) return;

    await this.enderecosService.create(TipoEntidadeEndereco.CLIENTE, clienteId, {
      ...enderecoPayload,
      principal: enderecoPayload.principal ?? true,
    });
  }

  async create(dto: CreateClienteDto) {
    const { endereco, ...dadosCliente } = dto as any;

    const cliente = await this.prisma.cliente.create({
      data: {
        ...dadosCliente,
        cnpjCpf:
          dadosCliente.cnpjCpf ?? `SEM-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });

    if (endereco) {
      await this.criarOuAtualizarEnderecoCliente(cliente.id, endereco);
    }

    return this.findOne(cliente.id);
  }

  async findAll(incluirInativos = false) {
    const clientes = await this.prisma.cliente.findMany({
      where: incluirInativos ? {} : { ativo: true },
      orderBy: [{ ativo: 'desc' }, { razaoSocialOuNome: 'asc' }],
    });

    return Promise.all(
      clientes.map(async (cliente) => ({
        ...cliente,
        enderecos: await this.enderecosService.findByEntidade(
          TipoEntidadeEndereco.CLIENTE,
          cliente.id,
        ),
      })),
    );
  }

  async search(termo: string) {
    const clientes = await this.prisma.cliente.findMany({
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

    return Promise.all(
      clientes.map(async (cliente) => ({
        ...cliente,
        enderecos: await this.enderecosService.findByEntidade(
          TipoEntidadeEndereco.CLIENTE,
          cliente.id,
        ),
      })),
    );
  }

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    const enderecos = await this.enderecosService.findByEntidade(TipoEntidadeEndereco.CLIENTE, id);
    return { ...cliente, enderecos };
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.findOne(id);

    const { endereco, ...dadosCliente } = dto as any;
    const clienteAtualizado = await this.prisma.cliente.update({
      where: { id },
      data: dadosCliente,
    });

    if (endereco) {
      await this.criarOuAtualizarEnderecoCliente(id, endereco);
    }

    return this.findOne(clienteAtualizado.id);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cliente.update({ where: { id }, data: { ativo: false } });
  }

  async reativar(id: string) {
    await this.findOne(id);
    return this.prisma.cliente.update({ where: { id }, data: { ativo: true } });
  }
}
