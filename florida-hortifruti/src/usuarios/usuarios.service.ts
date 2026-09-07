import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PapelUsuario, Prisma, TipoEntidadeEndereco } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';

const usuarioSelect = {
  id: true,
  nome: true,
  email: true,
  cpf: true,
  dataNascimento: true,
  telefone: true,
  whatsapp: true,
  enderecoPrincipalId: true,
  papel: true,
  ativo: true,
  criadoEm: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private enderecosService: EnderecosService,
  ) {}

  private async salvarEnderecoUsuario(usuarioId: string, dto: any | undefined) {
    if (!dto || (!dto.cidadeId && !dto.logradouro && !dto.endereco)) return;

    const payload = dto.endereco ?? dto;
    if (!payload?.cidadeId && !payload?.logradouro) return;

    const principalExistente = await this.enderecosService.findPrincipal(
      TipoEntidadeEndereco.USUARIO,
      usuarioId,
    );

    if (principalExistente) {
      await this.enderecosService.update(principalExistente.id, {
        ...payload,
        principal: payload.principal ?? true,
      });
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { enderecoPrincipalId: principalExistente.id },
      });
      return;
    }

    const enderecoCriado = await this.enderecosService.create(
      TipoEntidadeEndereco.USUARIO,
      usuarioId,
      {
        ...payload,
        principal: payload.principal ?? true,
      },
    );

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { enderecoPrincipalId: enderecoCriado.id },
    });
  }

  private isUniqueCpfError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = error.meta?.target;
    if (Array.isArray(target)) return target.includes('cpf');
    return String(target ?? '').includes('cpf');
  }

  private validarPerfilOperacionalCompleto(
    papel: PapelUsuario,
    usuario: {
      cpf?: string | null;
      dataNascimento?: string | Date | null;
      telefone?: string | null;
      whatsapp?: string | null;
    },
    endereco?: {
      cep?: string | null;
      logradouro?: string | null;
      numero?: string | null;
      bairro?: string | null;
      cidadeId?: string | null;
    } | null,
  ) {
    if (papel !== PapelUsuario.VENDEDOR && papel !== PapelUsuario.MOTORISTA) return;

    if (!usuario.cpf?.trim()) {
      throw new BadRequestException('Vendedor e motorista precisam ter CPF cadastrado');
    }
    if (!usuario.dataNascimento) {
      throw new BadRequestException(
        'Vendedor e motorista precisam ter data de nascimento cadastrada',
      );
    }
    if (!usuario.telefone?.trim()) {
      throw new BadRequestException('Vendedor e motorista precisam ter telefone cadastrado');
    }
    if (!usuario.whatsapp?.trim()) {
      throw new BadRequestException('Vendedor e motorista precisam ter WhatsApp cadastrado');
    }

    const enderecoCompleto =
      !!endereco?.cep?.trim() &&
      !!endereco?.logradouro?.trim() &&
      !!endereco?.numero?.trim() &&
      !!endereco?.bairro?.trim() &&
      !!endereco?.cidadeId?.trim();

    if (!enderecoCompleto) {
      throw new BadRequestException(
        'Vendedor e motorista precisam ter endereço principal completo',
      );
    }
  }

  async create(dto: CreateUsuarioDto) {
    if (dto.papel === PapelUsuario.CLIENTE) {
      throw new BadRequestException('Acesso de cliente é criado pelo convite em Clientes');
    }
    const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existe) throw new ConflictException('E-mail já cadastrado');

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const { endereco, ...dados } = dto as any;
    delete dados.senha;

    this.validarPerfilOperacionalCompleto(dto.papel, dados, endereco ?? null);

    let usuario;
    try {
      usuario = await this.prisma.usuario.create({
        data: {
          ...dados,
          cpf: dados.cpf ?? null,
          dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : null,
          telefone: dados.telefone ?? null,
          whatsapp: dados.whatsapp ?? null,
          senhaHash,
        },
        select: usuarioSelect,
      });
    } catch (error) {
      if (this.isUniqueCpfError(error)) {
        throw new ConflictException('Já existe usuário cadastrado com este CPF');
      }
      throw error;
    }

    if (endereco) {
      await this.salvarEnderecoUsuario(usuario.id, endereco);
    }

    return this.findOne(usuario.id);
  }

  async findAll() {
    const usuarios = await this.prisma.usuario.findMany({
      select: usuarioSelect,
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });

    return Promise.all(
      usuarios.map(async (usuario) => ({
        ...usuario,
        enderecos: await this.enderecosService.findByEntidade(
          TipoEntidadeEndereco.USUARIO,
          usuario.id,
        ),
      })),
    );
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioSelect,
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const enderecos = await this.enderecosService.findByEntidade(TipoEntidadeEndereco.USUARIO, id);
    return { ...usuario, enderecos };
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    const atual = await this.findOne(id);
    const { endereco, ...dados } = dto as any;

    if (dto.senha) {
      dados.senhaHash = await bcrypt.hash(dto.senha, 10);
    }
    delete dados.senha;

    const enderecoAtual =
      atual.enderecos?.find((item: any) => item.principal) ?? atual.enderecos?.[0];
    const papelFinal = (dados.papel ?? atual.papel) as PapelUsuario;
    const perfilFinal = {
      cpf: dados.cpf ?? atual.cpf,
      dataNascimento: dados.dataNascimento ?? atual.dataNascimento,
      telefone: dados.telefone ?? atual.telefone,
      whatsapp: dados.whatsapp ?? atual.whatsapp,
    };
    const enderecoFinal = endereco
      ? {
          cep: endereco.cep,
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          bairro: endereco.bairro,
          cidadeId: endereco.cidadeId,
        }
      : {
          cep: enderecoAtual?.cep,
          logradouro: enderecoAtual?.logradouro,
          numero: enderecoAtual?.numero,
          bairro: enderecoAtual?.bairro,
          cidadeId: enderecoAtual?.cidade?.id,
        };

    this.validarPerfilOperacionalCompleto(papelFinal, perfilFinal, enderecoFinal);

    let usuarioAtualizado;
    try {
      usuarioAtualizado = await this.prisma.usuario.update({
        where: { id },
        data: {
          ...dados,
          ...(dados.cpf !== undefined && { cpf: dados.cpf || null }),
          ...(dados.dataNascimento !== undefined && {
            dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : null,
          }),
          ...(dados.telefone !== undefined && { telefone: dados.telefone || null }),
          ...(dados.whatsapp !== undefined && { whatsapp: dados.whatsapp || null }),
        },
        select: usuarioSelect,
      });
    } catch (error) {
      if (this.isUniqueCpfError(error)) {
        throw new ConflictException('Já existe usuário cadastrado com este CPF');
      }
      throw error;
    }

    if (endereco) {
      await this.salvarEnderecoUsuario(usuarioAtualizado.id, endereco);
    }

    return this.findOne(usuarioAtualizado.id);
  }

  async desativar(id: string) {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: false },
      select: { id: true, nome: true, email: true, papel: true, ativo: true },
    });
  }

  async reativar(id: string) {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: true },
      select: { id: true, nome: true, email: true, papel: true, ativo: true },
    });
  }
}
