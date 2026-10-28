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
  private buscarPorNome(nome: string, ignorarId?: string) {
    return this.prisma.fornecedor.findFirst({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
      },
      orderBy: { ativo: 'desc' },
    });
  }

  private async validarNome(nome: string, ignorarId?: string) {
    const repetido = await this.buscarPorNome(nome, ignorarId);
    if (!repetido) return;
    const inativo = repetido.ativo ? '' : ' (inativo; reative-o na lista de fornecedores)';
    throw new BadRequestException(`Já existe o fornecedor ${repetido.nome}${inativo}`);
  }

  async create(dto: CreateFornecedorDto) {
    const nome = dto.nome.trim();
    const repetido = await this.buscarPorNome(nome);
    if (repetido?.ativo) throw new BadRequestException(`Já existe o fornecedor ${repetido.nome}`);
    // Apagar só inativa: cadastrar de novo o mesmo nome reativa o registro, mantendo as compras antigas
    if (repetido) {
      return this.prisma.fornecedor.update({
        where: { id: repetido.id },
        data: {
          nome,
          ativo: true,
          documento: opcional(dto.documento) ?? null,
          telefone: opcional(dto.telefone) ?? null,
          observacao: opcional(dto.observacao) ?? null,
        },
      });
    }
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
