import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TipoMovimentacao } from '@prisma/client';

@Injectable()
export class EstoqueService {
  constructor(private prisma: PrismaService) {}

  // Item 14 do escopo: entrada de estoque (compra)
  async registrarEntrada(params: {
    produtoId: string;
    quantidade: number;
    fornecedor: string;
    custoTotal: number;
    usuarioId: string;
    observacao?: string;
  }) {
    const custoUnitario = params.custoTotal / params.quantidade;
    return this.prisma.movimentacaoEstoque.create({
      data: {
        produtoId: params.produtoId,
        tipo: TipoMovimentacao.ENTRADA,
        quantidade: params.quantidade,
        origem: `Compra - ${params.fornecedor}`,
        fornecedor: params.fornecedor,
        custoTotal: params.custoTotal,
        custoUnitario,
        usuarioId: params.usuarioId,
        observacao: params.observacao,
      },
    });
  }

  // Item 15 do escopo: saída automática quando um pedido é aprovado
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

  // Item 16 do escopo: ajuste manual, sempre com motivo e responsável
  async registrarAjuste(params: {
    produtoId: string;
    quantidade: number; // pode ser positivo ou negativo
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

  // Item 18 do escopo: saldo atual = soma de todas as movimentações
  async saldoAtual(produtoId: string) {
    const resultado = await this.prisma.movimentacaoEstoque.aggregate({
      where: { produtoId },
      _sum: { quantidade: true },
    });
    return resultado._sum.quantidade ?? 0;
  }

  // Saldo de todos os produtos ativos — usado no dashboard e painel de estoque
  async saldosTodos() {
    const produtos = await this.prisma.produto.findMany({ where: { ativo: true } });
    const saldos = await Promise.all(
      produtos.map(async (p) => {
        const resultado = await this.prisma.movimentacaoEstoque.aggregate({
          where: { produtoId: p.id },
          _sum: { quantidade: true },
        });
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
        };
      }),
    );
    return saldos;
  }

  // Item 17 do escopo: histórico completo, nunca apagado
  historico(produtoId: string) {
    return this.prisma.movimentacaoEstoque.findMany({
      where: { produtoId },
      include: { usuario: { select: { nome: true } } },
      orderBy: { data: 'asc' },
    });
  }
}
