import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PapelUsuario, StatusConviteCliente } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { cliente: { select: { id: true, ativo: true } } },
    });

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (usuario.papel === PapelUsuario.CLIENTE && usuario.cliente && !usuario.cliente.ativo) {
      throw new UnauthorizedException('Acesso do cliente está desativado');
    }

    const senhaConfere = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaConfere) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { sub: usuario.id, email: usuario.email, papel: usuario.papel };
    const longaSessao =
      usuario.papel === PapelUsuario.MOTORISTA || usuario.papel === PapelUsuario.CLIENTE;

    return {
      access_token: this.jwtService.sign(payload, longaSessao ? { expiresIn: '30d' } : undefined),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        clienteId: usuario.cliente?.id ?? null,
      },
    };
  }

  async definirSenha(token: string, senha: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { tokenConvite: token } });
    if (!cliente) {
      throw new BadRequestException('Convite inválido ou já utilizado');
    }
    if (!cliente.tokenConviteExpiraEm || cliente.tokenConviteExpiraEm < new Date()) {
      throw new BadRequestException('Este convite expirou. Peça um novo acesso ao escritório.');
    }
    if (cliente.statusConvite === StatusConviteCliente.ATIVO && cliente.usuarioId) {
      throw new BadRequestException('Este convite já foi utilizado');
    }
    if (!cliente.email) {
      throw new BadRequestException('Cliente sem e-mail cadastrado');
    }

    const emailEmUso = await this.prisma.usuario.findUnique({ where: { email: cliente.email } });
    if (emailEmUso && emailEmUso.id !== cliente.usuarioId) {
      throw new BadRequestException('Já existe um usuário com o e-mail deste cliente');
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    return this.prisma.$transaction(async (tx) => {
      const usuario = cliente.usuarioId
        ? await tx.usuario.update({
            where: { id: cliente.usuarioId },
            data: { senhaHash, ativo: true, papel: PapelUsuario.CLIENTE },
          })
        : await tx.usuario.create({
            data: {
              nome: cliente.razaoSocialOuNome,
              email: cliente.email!,
              senhaHash,
              papel: PapelUsuario.CLIENTE,
            },
          });

      await tx.cliente.update({
        where: { id: cliente.id },
        data: {
          usuarioId: usuario.id,
          statusConvite: StatusConviteCliente.ATIVO,
          tokenConvite: null,
          tokenConviteExpiraEm: null,
        },
      });

      return { ok: true, email: usuario.email };
    });
  }
}
