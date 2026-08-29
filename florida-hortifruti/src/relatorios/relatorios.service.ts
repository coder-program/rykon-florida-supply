import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StatusPedido, StatusPagamento } from '@prisma/client';

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  private periodoWhere(dataInicio?: string, dataFim?: string) {
    const data: any = {};
    if (dataInicio) data.gte = new Date(dataInicio);
    if (dataFim) data.lte = new Date(dataFim);
    return Object.keys(data).length ? data : undefined;
  }

  // Seção 21: relatório de vendas por período
  async vendasPorPeriodo(dataInicio?: string, dataFim?: string) {
    const data = this.periodoWhere(dataInicio, dataFim);
    return this.prisma.pedido.findMany({
      where: {
        status: { notIn: [StatusPedido.RASCUNHO, StatusPedido.CANCELADO] },
        ...(data ? { data } : {}),
      },
      include: {
        cliente: { select: { razaoSocialOuNome: true, nomeFantasia: true } },
        vendedor: { select: { nome: true } },
        itens: { include: { produto: { select: { nome: true, codigoInterno: true } } } },
      },
      orderBy: { data: 'desc' },
    });
  }

  // Seção 21: relatório de vendas agrupado por vendedor
  async vendasPorVendedor(dataInicio?: string, dataFim?: string) {
    const data = this.periodoWhere(dataInicio, dataFim);
    const pedidos = await this.prisma.pedido.groupBy({
      by: ['vendedorId'],
      where: {
        status: { notIn: [StatusPedido.RASCUNHO, StatusPedido.CANCELADO] },
        ...(data ? { data } : {}),
      },
      _sum: { totalFinal: true },
      _count: { id: true },
    });

    const vendedores = await this.prisma.usuario.findMany({
      where: { id: { in: pedidos.map((p) => p.vendedorId) } },
      select: { id: true, nome: true },
    });

    return pedidos.map((p) => ({
      vendedor: vendedores.find((v) => v.id === p.vendedorId)?.nome ?? p.vendedorId,
      totalPedidos: p._count.id,
      totalVendido: p._sum.totalFinal ?? 0,
    }));
  }

  // Seção 21: relatório de vendas agrupado por produto
  async vendasPorProduto(dataInicio?: string, dataFim?: string) {
    const data = this.periodoWhere(dataInicio, dataFim);
    const itens = await this.prisma.itemPedido.groupBy({
      by: ['produtoId'],
      where: {
        pedido: {
          status: { notIn: [StatusPedido.RASCUNHO, StatusPedido.CANCELADO] },
          ...(data ? { data } : {}),
        },
      },
      _sum: { quantidade: true, valorTotal: true },
      _avg: { valorUnitario: true },
      _count: { id: true },
    });

    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: itens.map((i) => i.produtoId) } },
      select: { id: true, nome: true, codigoInterno: true, custo: true },
    });

    return itens.map((i) => {
      const produto = produtos.find((p) => p.id === i.produtoId);
      return {
        produto: produto?.nome ?? i.produtoId,
        codigoInterno: produto?.codigoInterno,
        quantidadeVendida: i._sum.quantidade ?? 0,
        faturamento: i._sum.valorTotal ?? 0,
        precoMedioVenda: i._avg.valorUnitario ?? 0,
        custoMedio: produto?.custo ?? null,
      };
    });
  }

  // Seção 21: relatório financeiro — recebidos, em aberto, vencidos
  async financeiro(dataInicio?: string, dataFim?: string) {
    const data = this.periodoWhere(dataInicio, dataFim);
    const base = {
      status: { notIn: [StatusPedido.RASCUNHO, StatusPedido.CANCELADO] },
      ...(data ? { data } : {}),
    };

    const [pagos, emAberto, vencidos] = await Promise.all([
      this.prisma.pedido.aggregate({ where: { ...base, statusPagamento: StatusPagamento.PAGO }, _sum: { totalFinal: true }, _count: { id: true } }),
      this.prisma.pedido.aggregate({ where: { ...base, statusPagamento: StatusPagamento.EM_ABERTO }, _sum: { totalFinal: true }, _count: { id: true } }),
      this.prisma.pedido.aggregate({ where: { ...base, statusPagamento: StatusPagamento.VENCIDO }, _sum: { totalFinal: true }, _count: { id: true } }),
    ]);

    return {
      pagos: { total: pagos._sum.totalFinal ?? 0, quantidade: pagos._count.id },
      emAberto: { total: emAberto._sum.totalFinal ?? 0, quantidade: emAberto._count.id },
      vencidos: { total: vencidos._sum.totalFinal ?? 0, quantidade: vencidos._count.id },
    };
  }

  // Seção 21: estoque atual com histórico de movimentações
  async estoqueAtual() {
    const produtos = await this.prisma.produto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } });

    return Promise.all(
      produtos.map(async (p) => {
        const resultado = await this.prisma.movimentacaoEstoque.aggregate({
          where: { produtoId: p.id },
          _sum: { quantidade: true },
        });
        return {
          produtoId: p.id,
          codigoInterno: p.codigoInterno,
          nome: p.nome,
          saldoAtual: resultado._sum.quantidade ?? 0,
          unidadeVenda: p.unidadeVenda,
        };
      }),
    );
  }

  // Seção 20: dados do dashboard com período selecionável
  async dashboard(dataInicio?: string, dataFim?: string) {
    const data = this.periodoWhere(dataInicio, dataFim);
    const base = {
      status: { notIn: [StatusPedido.RASCUNHO, StatusPedido.CANCELADO] },
      ...(data ? { data } : {}),
    };

    const [totalVendas, totalPedidos, emAberto, vencidos, estoque] = await Promise.all([
      this.prisma.pedido.aggregate({ where: base, _sum: { totalFinal: true } }),
      this.prisma.pedido.count({ where: base }),
      this.prisma.pedido.aggregate({ where: { ...base, statusPagamento: StatusPagamento.EM_ABERTO }, _sum: { totalFinal: true } }),
      this.prisma.pedido.aggregate({ where: { ...base, statusPagamento: StatusPagamento.VENCIDO }, _sum: { totalFinal: true } }),
      this.estoqueAtual(),
    ]);

    const caixasVendidas = await this.prisma.itemPedido.aggregate({
      where: { pedido: base },
      _sum: { quantidade: true },
    });

    return {
      totalVendas: totalVendas._sum.totalFinal ?? 0,
      totalPedidos,
      caixasVendidas: caixasVendidas._sum.quantidade ?? 0,
      valoresEmAberto: emAberto._sum.totalFinal ?? 0,
      valoresVencidos: vencidos._sum.totalFinal ?? 0,
      estoque,
    };
  }

  // Gera CSV simples para exportação (seção 21)
  async gerarCsvVendas(dataInicio?: string, dataFim?: string): Promise<string> {
    const pedidos = await this.vendasPorPeriodo(dataInicio, dataFim);
    const linhas: string[] = ['Número,Data,Cliente,Vendedor,Subtotal,Frete,Desconto,Total,Pagamento,StatusPagamento,NF'];

    for (const p of pedidos) {
      linhas.push(
        [
          p.numero,
          new Date(p.data).toLocaleDateString('pt-BR'),
          `"${p.cliente.razaoSocialOuNome}"`,
          `"${p.vendedor.nome}"`,
          p.subtotal,
          p.valorFrete,
          p.descontoValor,
          p.totalFinal,
          p.formaPagamento,
          p.statusPagamento,
          p.necessitaNF ? 'Sim' : 'Não',
        ].join(','),
      );
    }

    return linhas.join('\n');
  }

  async gerarCsvEstoque(): Promise<string> {
    const movs = await this.prisma.movimentacaoEstoque.findMany({
      include: {
        produto: { select: { nome: true, codigoInterno: true } },
        usuario: { select: { nome: true } },
      },
      orderBy: { data: 'asc' },
    });

    const linhas: string[] = ['Data,Tipo,Produto,Código,Quantidade,Origem,Usuário'];
    for (const m of movs) {
      linhas.push(
        [
          new Date(m.data).toLocaleDateString('pt-BR'),
          m.tipo,
          `"${m.produto.nome}"`,
          m.produto.codigoInterno,
          m.quantidade,
          `"${m.origem}"`,
          `"${m.usuario.nome}"`,
        ].join(','),
      );
    }

    return linhas.join('\n');
  }
}
