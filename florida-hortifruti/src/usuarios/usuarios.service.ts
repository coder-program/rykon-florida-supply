import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TipoEntidadeEndereco } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';

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

    await this.enderecosService.create(TipoEntidadeEndereco.USUARIO, usuarioId, {
      ...payload,
      principal: payload.principal ?? true,
    });
  }

  async create(dto: CreateUsuarioDto) {
    const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existe) throw new ConflictException('E-mail já cadastrado');

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const { endereco, ...dados } = dto as any;
    delete dados.senha;

    const usuario = await this.prisma.usuario.create({
      data: { ...dados, senhaHash },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });

    if (endereco) {
      await this.salvarEnderecoUsuario(usuario.id, endereco);
    }

    return this.findOne(usuario.id);
  }

  async findAll() {
    const usuarios = await this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
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
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const enderecos = await this.enderecosService.findByEntidade(TipoEntidadeEndereco.USUARIO, id);
    return { ...usuario, enderecos };
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    await this.findOne(id);
    const { endereco, ...dados } = dto as any;

    if (dto.senha) {
      dados.senhaHash = await bcrypt.hash(dto.senha, 10);
    }
    delete dados.senha;

    const usuarioAtualizado = await this.prisma.usuario.update({
      where: { id },
      data: dados,
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });

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
