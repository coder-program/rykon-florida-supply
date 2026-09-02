import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoEndereco, TipoEntidadeEndereco } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateEnderecoDto, UpdateEnderecoDto } from './dto/enderecos.dto';

@Injectable()
export class EnderecosService {
  constructor(private prisma: PrismaService) {}

  private normalizeEntidadeTipo(tipo: string | TipoEntidadeEndereco): TipoEntidadeEndereco {
    const value = String(tipo).toUpperCase();
    if (value in TipoEntidadeEndereco)
      return TipoEntidadeEndereco[value as keyof typeof TipoEntidadeEndereco];
    throw new BadRequestException('Tipo de entidade de endereço inválido');
  }

  private normalizeTipoEndereco(tipo?: string): TipoEndereco {
    const value = (tipo ?? 'PRINCIPAL').toUpperCase();
    if (value in TipoEndereco) return TipoEndereco[value as keyof typeof TipoEndereco];
    throw new BadRequestException('Tipo de endereço inválido');
  }

  async create(
    entidadeTipo: TipoEntidadeEndereco | string,
    entidadeId: string,
    dto: CreateEnderecoDto,
  ) {
    const tipoEntidade = this.normalizeEntidadeTipo(entidadeTipo);
    const cidade = await this.prisma.cidade.findUnique({
      where: { id: dto.cidadeId },
      include: { estado: true },
    });
    if (!cidade) throw new NotFoundException('Cidade não encontrada');

    if (dto.principal) {
      await this.prisma.endereco.updateMany({
        where: { entidadeTipo: tipoEntidade, entidadeId, principal: true },
        data: { principal: false },
      });
    }

    return this.prisma.endereco.create({
      data: {
        entidadeTipo: tipoEntidade,
        entidadeId,
        tipo: this.normalizeTipoEndereco(dto.tipo),
        principal: dto.principal ?? true,
        cep: dto.cep ?? null,
        logradouro: dto.logradouro ?? '',
        numero: dto.numero ?? null,
        complemento: dto.complemento ?? null,
        bairro: dto.bairro ?? null,
        cidadeId: dto.cidadeId,
        pontoReferencia: dto.pontoReferencia ?? null,
      },
      include: { cidade: { include: { estado: true } } },
    });
  }

  findByEntidade(entidadeTipo: TipoEntidadeEndereco | string, entidadeId: string) {
    return this.prisma.endereco.findMany({
      where: {
        entidadeTipo: this.normalizeEntidadeTipo(entidadeTipo),
        entidadeId,
      },
      orderBy: [{ principal: 'desc' }, { criadoEm: 'asc' }],
      include: { cidade: { include: { estado: true } } },
    });
  }

  async findPrincipal(entidadeTipo: TipoEntidadeEndereco | string, entidadeId: string) {
    const endereco = await this.prisma.endereco.findFirst({
      where: {
        entidadeTipo: this.normalizeEntidadeTipo(entidadeTipo),
        entidadeId,
        principal: true,
      },
      include: { cidade: { include: { estado: true } } },
    });
    if (!endereco) return null;
    return endereco;
  }

  async update(id: string, dto: UpdateEnderecoDto) {
    const enderecoAtual = await this.prisma.endereco.findUnique({ where: { id } });
    if (!enderecoAtual) throw new NotFoundException('Endereço não encontrado');

    if (dto.cidadeId) {
      const cidade = await this.prisma.cidade.findUnique({ where: { id: dto.cidadeId } });
      if (!cidade) throw new NotFoundException('Cidade não encontrada');
    }

    if (dto.principal) {
      await this.prisma.endereco.updateMany({
        where: {
          entidadeTipo: enderecoAtual.entidadeTipo,
          entidadeId: enderecoAtual.entidadeId,
          principal: true,
          id: { not: id },
        },
        data: { principal: false },
      });
    }

    return this.prisma.endereco.update({
      where: { id },
      data: {
        ...(dto.cep !== undefined && { cep: dto.cep ?? null }),
        ...(dto.logradouro !== undefined && { logradouro: dto.logradouro ?? '' }),
        ...(dto.numero !== undefined && { numero: dto.numero ?? null }),
        ...(dto.complemento !== undefined && { complemento: dto.complemento ?? null }),
        ...(dto.bairro !== undefined && { bairro: dto.bairro ?? null }),
        ...(dto.cidadeId !== undefined && { cidadeId: dto.cidadeId }),
        ...(dto.pontoReferencia !== undefined && { pontoReferencia: dto.pontoReferencia ?? null }),
        ...(dto.principal !== undefined && { principal: dto.principal }),
        ...(dto.tipo !== undefined && { tipo: this.normalizeTipoEndereco(dto.tipo) }),
      },
      include: { cidade: { include: { estado: true } } },
    });
  }

  async remove(id: string) {
    const endereco = await this.prisma.endereco.findUnique({ where: { id } });
    if (!endereco) throw new NotFoundException('Endereço não encontrado');
    await this.prisma.endereco.delete({ where: { id } });
    return { ok: true };
  }
}
