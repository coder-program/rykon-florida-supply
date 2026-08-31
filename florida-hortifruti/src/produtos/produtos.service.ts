import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/produto.dto';

@Injectable()
export class ProdutosService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateProdutoDto) {
    return this.prisma.produto.create({ data: dto });
  }

  async findAll(incluirInativos = false) {
    const produtos = await this.prisma.produto.findMany({
      where: incluirInativos ? {} : { ativo: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });

    const produtosComEstoque = await Promise.all(
      produtos.map(async (produto) => {
        const saldo = await this.prisma.movimentacaoEstoque.aggregate({
          where: { produtoId: produto.id },
          _sum: { quantidade: true },
        });

        const estoqueAtual = Number(saldo._sum.quantidade ?? 0);

        console.log('[DEBUG] ProdutosService.findAll', {
          produtoId: produto.id,
          codigoInterno: produto.codigoInterno,
          nome: produto.nome,
          estoqueAtual,
          saldoBruto: saldo._sum.quantidade,
        });

        return {
          ...produto,
          estoqueAtual,
        };
      }),
    );

    return produtosComEstoque;
  }

  async findOne(id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return produto;
  }

  // Item 7 do escopo: registra HistoricoPreco quando o preço sugerido é alterado
  async update(id: string, dto: UpdateProdutoDto, usuarioId: string) {
    const produto = await this.findOne(id);

    if (dto.codigoInterno && dto.codigoInterno !== produto.codigoInterno) {
      const existe = await this.prisma.produto.findUnique({ where: { codigoInterno: dto.codigoInterno } });
      if (existe) throw new ConflictException('Já existe um produto com este código interno');
    }

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
