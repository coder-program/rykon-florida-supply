import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/produto.dto';

@Injectable()
export class ProdutosService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateProdutoDto) {
    return this.prisma.produto.create({ data: dto });
  }

  findAll(incluirInativos = false) {
    return this.prisma.produto.findMany({
      where: incluirInativos ? {} : { ativo: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async findOne(id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return produto;
  }

  // Item 7 do escopo: registra HistoricoPreco quando o preço sugerido é alterado
  async update(id: string, dto: UpdateProdutoDto, usuarioId: string) {
    const produto = await this.findOne(id);

    const ops: any[] = [this.prisma.produto.update({ where: { id }, data: dto })];

    if (dto.precoSugerido !== undefined && Number(produto.precoSugerido) !== dto.precoSugerido) {
      ops.push(
        this.prisma.historicoPreco.create({
          data: {
            produtoId: id,
            usuarioId,
            valorAnterior: produto.precoSugerido,
            valorNovo: dto.precoSugerido,
          },
        }),
      );
    }

    const [produtoAtualizado] = await this.prisma.$transaction(ops);
    return produtoAtualizado;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.produto.update({ where: { id }, data: { ativo: false } });
  }

  async reativar(id: string) {
    await this.findOne(id);
    return this.prisma.produto.update({ where: { id }, data: { ativo: true } });
  }

  historicoPrecos(produtoId: string) {
    return this.prisma.historicoPreco.findMany({
      where: { produtoId },
      include: { usuario: { select: { nome: true } } },
      orderBy: { data: 'desc' },
    });
  }
}
