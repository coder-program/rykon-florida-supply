import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PapelUsuario, Prisma, StatusConviteCliente, TipoEntidadeEndereco } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

type UsuarioLogado = { id: string; papel: PapelUsuario };

// Revendedor só enxerga os clientes dele; a equipe da Flórida, só os da Flórida
function filtroDono(usuario?: UsuarioLogado): Prisma.ClienteWhereInput {
  if (!usuario) return {};
  return usuario.papel === PapelUsuario.REVENDEDOR
    ? { revendedorId: usuario.id }
    : { revendedorId: null };
}

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

  // cnpjCpf é @unique: cliente sem documento recebe um placeholder único
  // (senão o segundo cliente sem CPF/CNPJ colide com o primeiro).
  private gerarPlaceholderDoc() {
    return `SEM-DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // O placeholder é detalhe interno: para a tela, cliente sem documento tem cnpjCpf null.
  private semPlaceholderDoc<T extends { cnpjCpf: string }>(cliente: T) {
    return {
      ...cliente,
      cnpjCpf: cliente.cnpjCpf.startsWith('SEM-DOC-') ? null : cliente.cnpjCpf,
    };
  }

  async create(dto: CreateClienteDto, usuario?: UsuarioLogado) {
    const { endereco, ...dadosCliente } = dto as any;

    let cliente;
    try {
      cliente = await this.prisma.cliente.create({
        data: {
          ...dadosCliente,
          cnpjCpf: dadosCliente.cnpjCpf || this.gerarPlaceholderDoc(),
          revendedorId: usuario?.papel === PapelUsuario.REVENDEDOR ? usuario.id : null,
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

  async findAll(incluirInativos = false, usuario?: UsuarioLogado) {
    const clientes = await this.prisma.cliente.findMany({
      where: { ...filtroDono(usuario), ...(incluirInativos ? {} : { ativo: true }) },
      orderBy: [{ ativo: 'desc' }, { razaoSocialOuNome: 'asc' }],
    });

    return Promise.all(
      clientes.map(async (cliente) => ({
        ...this.semPlaceholderDoc(cliente),
        enderecos: await this.enderecosService.findByEntidade(
          TipoEntidadeEndereco.CLIENTE,
          cliente.id,
        ),
      })),
    );
  }

  async search(termo: string, usuario?: UsuarioLogado) {
    const clientes = await this.prisma.cliente.findMany({
      where: {
        ...filtroDono(usuario),
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
        ...this.semPlaceholderDoc(cliente),
        enderecos: await this.enderecosService.findByEntidade(
          TipoEntidadeEndereco.CLIENTE,
          cliente.id,
        ),
      })),
    );
  }

  // Revendedor só abre/edita cliente dele; a equipe da Flórida não mexe nos do revendedor
  async garantirAcesso(id: string, usuario: UsuarioLogado) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      select: { revendedorId: true },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    const permitido =
      usuario.papel === PapelUsuario.REVENDEDOR
        ? cliente.revendedorId === usuario.id
        : cliente.revendedorId === null;
    if (!permitido) throw new ForbiddenException('Você não tem acesso a este cliente');
  }

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    const enderecos = await this.enderecosService.findByEntidade(TipoEntidadeEndereco.CLIENTE, id);
    return { ...this.semPlaceholderDoc(cliente), enderecos };
  }

  async update(id: string, dto: UpdateClienteDto) {
    const atual = await this.findOne(id);

    const { endereco, ...dadosCliente } = dto as any;
    if (dadosCliente.cnpjCpf !== undefined && !dadosCliente.cnpjCpf) {
      // Documento apagado (ou continua vazio): mantém/gera placeholder único.
      if (atual.cnpjCpf === null) delete dadosCliente.cnpjCpf;
      else dadosCliente.cnpjCpf = this.gerarPlaceholderDoc();
    }
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
