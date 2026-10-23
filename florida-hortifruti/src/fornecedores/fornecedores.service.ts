import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFornecedorDto, UpdateFornecedorDto } from './dto/fornecedor.dto';

// Campo opcional vazio vira null (o formulário manda "")
function opcional(valor?: string) {
  if (valor === undefined) return undefined;
  return valor.trim() || null;
}

@Injectable()
export class FornecedoresService {
  constructor(private prisma: PrismaService) {}

  findAll(incluirInativos = false) {
    return this.prisma.fornecedor.findMany({
      where: incluirInativos ? {} : { ativo: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async findOne(id: string) {
    const fornecedor = await this.prisma.fornecedor.findUnique({ where: { id } });
    if (!fornecedor) throw new NotFoundException('Fornecedor não encontrado');
    return fornecedor;
  }

  // Mesmo nome (sem diferenciar maiúsculas) não pode ser cadastrado duas vezes
  private async validarNome(nome: string, ignorarId?: string) {
    const repetido = await this.prisma.fornecedor.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
    });
    if (repetido) throw new BadRequestException(`Já existe o fornecedor ${repetido.nome}`);
  }

  async create(dto: CreateFornecedorDto) {
    const nome = dto.nome.trim();
    await this.validarNome(nome);
    return this.prisma.fornecedor.create({
      data: {
        nome,
        documento: opcional(dto.documento),
        telefone: opcional(dto.telefone),
        observacao: opcional(dto.observacao),
      },
    });
  }

  async update(id: string, dto: UpdateFornecedorDto) {
    await this.findOne(id);
    const nome = dto.nome?.trim();
    if (nome) await this.validarNome(nome, id);
    return this.prisma.fornecedor.update({
      where: { id },
      data: {
        nome,
        documento: opcional(dto.documento),
        telefone: opcional(dto.telefone),
        observacao: opcional(dto.observacao),
      },
    });
  }

  // Inativa em vez de apagar: as compras antigas continuam ligadas a ele
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
  }

  async reativar(id: string) {
    await this.findOne(id);
    return this.prisma.fornecedor.update({ where: { id }, data: { ativo: true } });
  }
}
