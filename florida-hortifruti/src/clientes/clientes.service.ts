import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusConviteCliente, TipoEntidadeEndereco } from '@prisma/client';
import { randomUUID } from 'crypto';
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

  private isUniqueCnpjCpfError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.includes('cnpjCpf');
    return String(target ?? '').includes('cnpjCpf');
  }

  async create(dto: CreateClienteDto) {
    const { endereco, ...dadosCliente } = dto as any;

    let cliente;
    try {
      cliente = await this.prisma.cliente.create({
        data: {
          ...dadosCliente,
          cnpjCpf:
            dadosCliente.cnpjCpf ??
            `SEM-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      });
    } catch (error) {
      if (this.isUniqueCnpjCpfError(error)) {
        throw new ConflictException('Já existe cliente cadastrado com este CPF/CNPJ');
      }
      throw error;
    }

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
    let clienteAtualizado;
    try {
      clienteAtualizado = await this.prisma.cliente.update({
        where: { id },
        data: dadosCliente,
      });
    } catch (error) {
      if (this.isUniqueCnpjCpfError(error)) {
        throw new ConflictException('Já existe cliente cadastrado com este CPF/CNPJ');
      }
      throw error;
    }

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

  async ativarAcesso(id: string, emailInformado?: string) {
    const cliente = await this.findOne(id);
    const email = (emailInformado ?? cliente.email)?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Informe o e-mail que o cliente vai usar para entrar');
    }
    if (email !== cliente.email) {
      await this.prisma.cliente.update({ where: { id }, data: { email } });
    }
    if (cliente.statusConvite === StatusConviteCliente.ATIVO && cliente.usuarioId) {
      throw new BadRequestException('Este cliente já possui acesso ativo');
    }

    const token = randomUUID();
    const expira = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const atualizado = await this.prisma.cliente.update({
      where: { id },
      data: {
        email,
        tokenConvite: token,
        tokenConviteExpiraEm: expira,
        statusConvite: StatusConviteCliente.CONVITE_ENVIADO,
      },
    });

    const base =
      process.env.PWA_CLIENTE_PUBLIC_URL || process.env.PWA_PUBLIC_URL || 'http://localhost:5201';
    return {
      ...atualizado,
      linkConvite: `${base.replace(/\/$/, '')}/definir-senha?token=${token}`,
    };
  }

  async findByUsuarioId(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { usuarioId } });
    if (!cliente) throw new NotFoundException('Cliente não vinculado a este usuário');
    return this.findOne(cliente.id);
  }
}
