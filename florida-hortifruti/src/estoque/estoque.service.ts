import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TipoMovimentacao } from '@prisma/client';

type ItemEntrada = {
  produtoId: string;
  quantidade: number;
  valorProduto: number;
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
    const valoresCents = itens.map((item) => this.toCents(item.valorProduto || 0));
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

      for (const item of rateados) {
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
          select: {
            valorProdutoInformado: true,
            rateioFrete: true,
            rateioComissao: true,
            custoUnitarioFinal: true,
            compra: { select: { fornecedor: true, valorFrete: true, valorComissao: true } },
          },
        },
      },
      orderBy: { data: 'asc' },
    });
  }
}
