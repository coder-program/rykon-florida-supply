import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    const existe = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existe) throw new ConflictException('E-mail já cadastrado');

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const dados: any = { ...dto };
    delete dados.senha;
    return this.prisma.usuario.create({
      data: { ...dados, senhaHash },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });
  }

  findAll() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    await this.findOne(id);
    const dados: any = { ...dto };
    if (dto.senha) {
      dados.senhaHash = await bcrypt.hash(dto.senha, 10);
      delete dados.senha;
    }
    return this.prisma.usuario.update({
      where: { id },
      data: dados,
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });
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
