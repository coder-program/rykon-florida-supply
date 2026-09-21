import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, TipoMovimentacao } from '@prisma/client';

type ItemEntrada = {
  produtoId: string;
  quantidade: number;
  valorProduto: number;
  numeroLote?: string;
};

@Injectable()
export class EstoqueService {
  constructor(private prisma: PrismaService) {}

  private toCents(value: number) {
    return Math.round(Number(value) * 100);
  }

  private fromCents(cents: number) {
    return Number((cents / 100).toFixed(2));
  }

  calcularRateio(itens: ItemEntrada[], valorFrete = 0, valorComissao = 0) {
    const freteCents = this.toCents(valorFrete || 0);
    const comissaoCents = this.toCents(valorComissao || 0);
    const valoresCents = itens.map((item) =>
      this.toCents(Number(item.quantidade || 0) * Number(item.valorProduto || 0)),
    );
    const totalCents = valoresCents.reduce((acc, value) => acc + value, 0);

    let usadoFrete = 0;
    let usadoComissao = 0;

    return itens.map((item, index) => {
      const ultimo = index === itens.length - 1;
      const peso = totalCents > 0 ? valoresCents[index] / totalCents : 1 / itens.length;
      const rateioFreteCents = ultimo ? freteCents - usadoFrete : Math.round(freteCents * peso);
      const rateioComissaoCents = ultimo
        ? comissaoCents - usadoComissao
        : Math.round(comissaoCents * peso);

      usadoFrete += rateioFreteCents;
      usadoComissao += rateioComissaoCents;

      const valorProduto = this.fromCents(valoresCents[index]);
      const rateioFrete = this.fromCents(rateioFreteCents);
      const rateioComissao = this.fromCents(rateioComissaoCents);
      const custoTotalItem = Number((valorProduto + rateioFrete + rateioComissao).toFixed(2));
      const custoUnitarioFinal = Number((custoTotalItem / item.quantidade).toFixed(4));

      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorProdutoInformado: valorProduto,
        rateioFrete,
        rateioComissao,
        custoTotalItem,
        custoUnitarioFinal,
      };
    });
  }

  async registrarEntrada(params: {
    fornecedor: string;
    usuarioId: string;
    itens: ItemEntrada[];
    valorFrete?: number;
    valorComissao?: number;
    observacao?: string;
  }) {
    const itens = (params.itens ?? []).filter((item) => item.produtoId && item.quantidade > 0);
    if (itens.length === 0) {
      throw new BadRequestException('Informe pelo menos um produto na compra');
    }

    const ids = [...new Set(itens.map((item) => item.produtoId))];
    const produtos = await this.prisma.produto.findMany({ where: { id: { in: ids } } });
    if (produtos.length !== ids.length) {
      throw new BadRequestException('Um ou mais produtos da compra não existem');
    }

    const valorFrete = Number(params.valorFrete ?? 0);
    const valorComissao = Number(params.valorComissao ?? 0);
    const rateados = this.calcularRateio(itens, valorFrete, valorComissao);

    return this.prisma.$transaction(async (tx) => {
      const compra = await tx.compraEstoque.create({
        data: {
          fornecedor: params.fornecedor,
          valorFrete,
          valorComissao,
          observacao: params.observacao,
          usuarioId: params.usuarioId,
        },
      });

      for (const [index, item] of rateados.entries()) {
        const movimentacao = await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            tipo: TipoMovimentacao.ENTRADA,
            quantidade: item.quantidade,
            origem: `Compra - ${params.fornecedor}`,
            fornecedor: params.fornecedor,
            custoTotal: item.custoTotalItem,
            custoUnitario: item.custoUnitarioFinal,
            usuarioId: params.usuarioId,
            observacao: params.observacao,
          },
        });

        const numeroLote =
          itens[index]?.numeroLote?.trim() ||
          `L-${item.produtoId.slice(0, 8)}-${Date.now()}-${index + 1}`;

        const lote = await tx.loteProduto.create({
          data: {
            produtoId: item.produtoId,
            numero: numeroLote,
            quantidadeInicial: item.quantidade,
            quantidadeDisponivel: item.quantidade,
            valorUnitario: item.custoUnitarioFinal,
            observacao: params.observacao,
          },
        });

        await tx.movimentacaoEstoqueLote.create({
          data: {
            loteId: lote.id,
            movimentacaoId: movimentacao.id,
            quantidade: item.quantidade,
            origem: `Compra - ${params.fornecedor}`,
          },
        });

        await tx.itemCompraEstoque.create({
          data: {
            compraId: compra.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            valorProdutoInformado: item.valorProdutoInformado,
            rateioFrete: item.rateioFrete,
            rateioComissao: item.rateioComissao,
            custoUnitarioFinal: item.custoUnitarioFinal,
            movimentacaoId: movimentacao.id,
          },
        });

        await tx.produto.update({
          where: { id: item.produtoId },
          data: { custo: item.custoUnitarioFinal },
        });
      }

      return tx.compraEstoque.findUnique({
        where: { id: compra.id },
        include: {
          itens: {
            include: { produto: { select: { nome: true, codigoInterno: true } } },
          },
        },
      });
    });
  }

  async validarDisponibilidade(itens: { produtoId: string; quantidade: number }[]) {
    const porProduto = new Map<string, number>();
    for (const item of itens) {
      porProduto.set(
        item.produtoId,
        (porProduto.get(item.produtoId) ?? 0) + Number(item.quantidade || 0),
      );
    }

    const faltando: string[] = [];

    for (const [produtoId, quantidade] of porProduto) {
      const lotes = await this.prisma.loteProduto.findMany({
        where: { produtoId, ativo: true, quantidadeDisponivel: { gt: 0 } },
        orderBy: [{ dataEntrada: 'asc' }, { criadoEm: 'asc' }],
        select: { quantidadeDisponivel: true, numero: true },
      });

      const disponivel = lotes.reduce(
        (acc, lote) => acc + Number(lote.quantidadeDisponivel ?? 0),
        0,
      );

      if (disponivel < quantidade) {
        const produto = await this.prisma.produto.findUnique({
          where: { id: produtoId },
          select: { nome: true },
        });

        faltando.push(
          `${produto?.nome ?? produtoId} (pedido ${quantidade} cx, estoque em lotes ${disponivel} cx)`,
        );
      }
    }

    if (faltando.length > 0) {
      throw new BadRequestException(`Sem estoque suficiente: ${faltando.join('; ')}`);
    }
  }

  async listarLotesProduto(produtoId: string) {
    return this.prisma.loteProduto.findMany({
      where: { produtoId, ativo: true },
      orderBy: [{ dataEntrada: 'asc' }, { criadoEm: 'asc' }],
    });
  }

  async consumirLotesEmTx(
    tx: Prisma.TransactionClient,
    params: {
      produtoId: string;
      quantidade: number;
      pedidoId: string;
      origem: string;
      usuarioId: string;
      movimentacaoId: string;
      valorUnitario?: number;
    },
  ) {
    const quantidadeRestante = Number(params.quantidade || 0);
    if (quantidadeRestante <= 0) return [];

    const lotes = await tx.loteProduto.findMany({
      where: { produtoId: params.produtoId, ativo: true, quantidadeDisponivel: { gt: 0 } },
      orderBy: [{ dataEntrada: 'asc' }, { criadoEm: 'asc' }],
    });

    let restante = quantidadeRestante;
    const usados: {
      loteId: string;
      quantidade: number;
      saldoAntes: number;
      saldoDepois: number;
    }[] = [];

    for (const lote of lotes) {
      if (restante <= 0) break;
      const disponivel = Number(lote.quantidadeDisponivel ?? 0);
      const consumido = Math.min(restante, disponivel);
      if (consumido <= 0) continue;

      restante -= consumido;
      const novaDisponibilidade = Number((disponivel - consumido).toFixed(2));

      await tx.loteProduto.update({
        where: { id: lote.id },
        data: { quantidadeDisponivel: novaDisponibilidade },
      });

      await tx.movimentacaoEstoqueLote.create({
        data: {
          loteId: lote.id,
          movimentacaoId: params.movimentacaoId,
          quantidade: consumido,
          origem: params.origem,
        },
      });

      // Registra o consumo por lote associado ao pedido, para rastreabilidade (qual lote saiu em qual venda)
      const valorUnitario = Number(params.valorUnitario ?? 0);
      await tx.itemPedidoLote.create({
        data: {
          pedidoId: params.pedidoId,
          produtoId: params.produtoId,
          loteId: lote.id,
          quantidade: consumido,
          valorUnitario,
          valorTotal: Number((consumido * valorUnitario).toFixed(2)),
        },
      });

      usados.push({
        loteId: lote.id,
        quantidade: consumido,
        saldoAntes: disponivel,
        saldoDepois: novaDisponibilidade,
      });
    }

    if (restante > 0) {
      throw new BadRequestException(
        `Sem estoque suficiente em lotes para o produto solicitado (faltam ${restante} unidades)`,
      );
    }

    return usados;
  }

  // Consulta de rastreabilidade: para um pedido, quais lotes foram usados em cada produto
  async lotesUtilizadosNoPedido(pedidoId: string) {
    const itens = await this.prisma.itemPedidoLote.findMany({
      where: { pedidoId },
      include: {
        produto: { select: { nome: true, codigoInterno: true } },
        lote: { select: { numero: true, dataEntrada: true } },
      },
      orderBy: [{ produtoId: 'asc' }, { lote: { dataEntrada: 'asc' } }],
    });

    return itens.map((item) => ({
      produtoId: item.produtoId,
      produtoNome: item.produto.nome,
      codigoInterno: item.produto.codigoInterno,
      loteId: item.loteId,
      loteNumero: item.lote.numero,
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valorUnitario),
      valorTotal: Number(item.valorTotal),
    }));
  }

  async registrarSaida(params: {
    produtoId: string;
    quantidade: number;
    pedidoId: string;
    numeroPedido: number;
    usuarioId: string;
  }) {
    return this.prisma.movimentacaoEstoque.create({
      data: {
        produtoId: params.produtoId,
        tipo: TipoMovimentacao.SAIDA,
        quantidade: -Math.abs(params.quantidade),
        origem: `Pedido ${params.numeroPedido}`,
        pedidoId: params.pedidoId,
        usuarioId: params.usuarioId,
      },
    });
  }

  async registrarAjuste(params: {
    produtoId: string;
    quantidade: number;
    motivo: string;
    usuarioId: string;
    observacao?: string;
  }) {
    return this.prisma.movimentacaoEstoque.create({
      data: {
        produtoId: params.produtoId,
        tipo: TipoMovimentacao.AJUSTE,
        quantidade: params.quantidade,
        origem: 'Ajuste manual',
        motivoAjuste: params.motivo,
        usuarioId: params.usuarioId,
        observacao: params.observacao,
      },
    });
  }

  async saldoAtual(produtoId: string) {
    const resultado = await this.prisma.movimentacaoEstoque.aggregate({
      where: { produtoId },
      _sum: { quantidade: true },
    });
    return resultado._sum.quantidade ?? 0;
  }

  async saldosTodos() {
    const produtos = await this.prisma.produto.findMany({ where: { ativo: true } });
    const saldos = await Promise.all(
      produtos.map(async (p) => {
        const [resultado, ultimaEntrada] = await Promise.all([
          this.prisma.movimentacaoEstoque.aggregate({
            where: { produtoId: p.id },
            _sum: { quantidade: true },
          }),
          this.prisma.movimentacaoEstoque.findFirst({
            where: {
              produtoId: p.id,
              tipo: TipoMovimentacao.ENTRADA,
              custoUnitario: { not: null },
            },
            orderBy: { data: 'desc' },
            select: { custoUnitario: true },
          }),
        ]);
        const saldoAtual = Number(resultado._sum.quantidade ?? 0);
        const estoqueMinimo = p.estoqueMinimo ? Number(p.estoqueMinimo) : null;
        return {
          produtoId: p.id,
          codigoInterno: p.codigoInterno,
          nome: p.nome,
          saldoAtual,
          unidadeVenda: p.unidadeVenda,
          estoqueMinimo,
          abaixoMinimo: estoqueMinimo !== null && saldoAtual < estoqueMinimo,
          custoCaixa:
            ultimaEntrada?.custoUnitario != null
              ? Number(ultimaEntrada.custoUnitario)
              : p.custo != null
                ? Number(p.custo)
                : null,
        };
      }),
    );
    return saldos;
  }

  historico(produtoId: string) {
    return this.prisma.movimentacaoEstoque.findMany({
      where: { produtoId },
      include: {
        usuario: { select: { nome: true } },
        itemCompra: {
          include: {
            compra: {
              include: {
                itens: {
                  include: {
                    produto: { select: { id: true, nome: true, codigoInterno: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { data: 'desc' },
    });
  }
}
