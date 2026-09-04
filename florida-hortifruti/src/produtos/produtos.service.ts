import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/produto.dto';

export type StatusDisponibilidade = 'DISPONIVEL' | 'POUCA_QUANTIDADE' | 'INDISPONIVEL';

@Injectable()
export class ProdutosService {
  constructor(private prisma: PrismaService) {}

  static disponibilidade(
    saldo: number,
    limiteEstoqueBaixo?: number | null,
    estoqueMinimo?: number | null,
  ): StatusDisponibilidade {
    if (saldo <= 0) return 'INDISPONIVEL';
    const limite = limiteEstoqueBaixo ?? estoqueMinimo ?? null;
    if (limite !== null && saldo <= Number(limite)) return 'POUCA_QUANTIDADE';
    return 'DISPONIVEL';
  }

  create(dto: CreateProdutoDto) {
    return this.prisma.produto.create({
      data: dto,
      include: { categoria: true },
    });
  }

  async findAll(incluirInativos = false) {
    const produtos = await this.prisma.produto.findMany({
      where: incluirInativos ? {} : { ativo: true },
      include: { categoria: true },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });

    const ids = produtos.map((p) => p.id);
    const saldos = ids.length
      ? await this.prisma.movimentacaoEstoque.groupBy({
          by: ['produtoId'],
          where: { produtoId: { in: ids } },
          _sum: { quantidade: true },
        })
      : [];
    const saldoPorProduto = new Map(
      saldos.map((s) => [s.produtoId, Number(s._sum.quantidade ?? 0)]),
    );

    return produtos.map((produto) => {
      const estoqueAtual = saldoPorProduto.get(produto.id) ?? 0;
      const disponibilidade = ProdutosService.disponibilidade(
        estoqueAtual,
        produto.limiteEstoqueBaixo != null ? Number(produto.limiteEstoqueBaixo) : null,
        produto.estoqueMinimo != null ? Number(produto.estoqueMinimo) : null,
      );
      return {
        ...produto,
        estoqueAtual,
        disponibilidade,
      };
    });
  }

  async findOne(id: string) {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
      include: { categoria: true },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return produto;
  }

  async update(id: string, dto: UpdateProdutoDto, usuarioId: string) {
    const produto = await this.findOne(id);

    if (dto.codigoInterno && dto.codigoInterno !== produto.codigoInterno) {
      const existe = await this.prisma.produto.findUnique({
        where: { codigoInterno: dto.codigoInterno },
      });
      if (existe) throw new ConflictException('Já existe um produto com este código interno');
    }

    const ops: any[] = [
      this.prisma.produto.update({ where: { id }, data: dto, include: { categoria: true } }),
    ];

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
      include: {
        usuario: { select: { nome: true } },
        cliente: { select: { razaoSocialOuNome: true } },
      },
      orderBy: { data: 'desc' },
    });
  }

  listarCategorias() {
    return this.prisma.categoria.findMany({ orderBy: { nome: 'asc' } });
  }

  async criarCategoria(nome: string) {
    const existe = await this.prisma.categoria.findUnique({ where: { nome: nome.trim() } });
    if (existe) throw new ConflictException('Já existe uma categoria com este nome');
    return this.prisma.categoria.create({ data: { nome: nome.trim() } });
  }

  async atualizarCategoria(id: string, nome: string) {
    const categoria = await this.prisma.categoria.findUnique({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.categoria.update({ where: { id }, data: { nome: nome.trim() } });
  }

  async definirPrecoCliente(
    clienteId: string,
    produtoId: string,
    precoUnitario: number,
    usuarioId: string,
  ) {
    const produto = await this.findOne(produtoId);
    const atual = await this.prisma.precoCliente.findUnique({
      where: { clienteId_produtoId: { clienteId, produtoId } },
    });

    return this.prisma.$transaction(async (tx) => {
      const preco = await tx.precoCliente.upsert({
        where: { clienteId_produtoId: { clienteId, produtoId } },
        create: { clienteId, produtoId, precoUnitario, atualizadoPorId: usuarioId },
        update: { precoUnitario, atualizadoPorId: usuarioId },
      });
      await tx.historicoPreco.create({
        data: {
          produtoId,
          usuarioId,
          clienteId,
          valorAnterior: atual?.precoUnitario ?? produto.precoSugerido,
          valorNovo: precoUnitario,
        },
      });
      return preco;
    });
  }

  listarPrecosCliente(clienteId: string) {
    return this.prisma.precoCliente.findMany({
      where: { clienteId },
      include: { produto: { select: { id: true, nome: true, unidadeVenda: true } } },
      orderBy: { atualizadoEm: 'desc' },
    });
  }
}
