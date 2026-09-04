import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StatusPedido, StatusPagamento } from '@prisma/client';

type RelatorioQuery = {
  dataInicio?: string;
  dataFim?: string;
  status?: string;
  statusPagamento?: string;
  vendedorId?: string;
  produtoId?: string;
  categoria?: string;
  tipoMovimento?: string;
};

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  private parseLocalDate(value: string, endOfDay = false) {
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return new Date(value);
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  private periodoWhere(dataInicio?: string, dataFim?: string) {
    const data: any = {};
    if (dataInicio) data.gte = this.parseLocalDate(dataInicio);
    if (dataFim) data.lte = this.parseLocalDate(dataFim, true);
    return Object.keys(data).length ? data : undefined;
  }

  private buildPedidoWhere(query: RelatorioQuery = {}) {
    const { dataInicio, dataFim, status, statusPagamento, vendedorId } = query;
    const data = this.periodoWhere(dataInicio, dataFim);
    const statusValue = status && status !== 'TODOS' ? status : undefined;
    const pagamentoValue =
      statusPagamento && statusPagamento !== 'TODOS' ? statusPagamento : undefined;

    return {
      ...(statusValue
        ? { status: statusValue as StatusPedido }
        : { status: { notIn: [StatusPedido.CANCELADO, StatusPedido.REJEITADO] } }),
      ...(pagamentoValue ? { statusPagamento: pagamentoValue as StatusPagamento } : {}),
      ...(vendedorId ? { vendedorId } : {}),
      ...(data ? { data } : {}),
    };
  }

  private sanitizeString(value?: string | null) {
    return value ? value.toString().trim() : undefined;
  }

  private csvEscape(value: unknown): string {
    const text = String(value ?? '').replace(/"/g, '""');
    return `"${text}"`;
  }

  async vendasPorPeriodo(query: RelatorioQuery = {}) {
    const { produtoId } = query;
    return this.prisma.pedido.findMany({
      where: {
        ...(produtoId ? { itens: { some: { produtoId } } } : {}),
        ...this.buildPedidoWhere(query),
      },
      include: {
        cliente: { select: { razaoSocialOuNome: true, nomeFantasia: true } },
        vendedor: { select: { nome: true } },
        itens: { include: { produto: { select: { nome: true, codigoInterno: true } } } },
      },
      orderBy: { data: 'desc' },
    });
  }

  async vendasPorVendedor(query: RelatorioQuery = {}) {
    const pedidos = await this.prisma.pedido.groupBy({
      by: ['vendedorId'],
      where: this.buildPedidoWhere(query),
      _sum: { totalFinal: true },
      _count: { id: true },
    });

    const vendedores = await this.prisma.usuario.findMany({
      where: { id: { in: pedidos.map((p) => p.vendedorId).filter((id): id is string => !!id) } },
      select: { id: true, nome: true },
    });

    return pedidos.map((p) => ({
      vendedor: vendedores.find((v) => v.id === p.vendedorId)?.nome ?? p.vendedorId,
      totalPedidos: p._count.id,
      totalVendido: p._sum.totalFinal ?? 0,
    }));
  }

  async vendasPorProduto(query: RelatorioQuery = {}) {
    const { produtoId } = query;
    const itens = await this.prisma.itemPedido.groupBy({
      by: ['produtoId'],
      where: {
        ...(produtoId ? { produtoId } : {}),
        pedido: this.buildPedidoWhere(query),
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

  async financeiro(query: RelatorioQuery = {}) {
    const base = this.buildPedidoWhere(query);

    const [pagos, emAberto, vencidos] = await Promise.all([
      this.prisma.pedido.aggregate({
        where: { ...base, statusPagamento: StatusPagamento.PAGO },
        _sum: { totalFinal: true },
        _count: { id: true },
      }),
      this.prisma.pedido.aggregate({
        where: { ...base, statusPagamento: StatusPagamento.EM_ABERTO },
        _sum: { totalFinal: true },
        _count: { id: true },
      }),
      this.prisma.pedido.aggregate({
        where: { ...base, statusPagamento: StatusPagamento.VENCIDO },
        _sum: { totalFinal: true },
        _count: { id: true },
      }),
    ]);

    return {
      pagos: { total: pagos._sum.totalFinal ?? 0, quantidade: pagos._count.id },
      emAberto: { total: emAberto._sum.totalFinal ?? 0, quantidade: emAberto._count.id },
      vencidos: { total: vencidos._sum.totalFinal ?? 0, quantidade: vencidos._count.id },
    };
  }

  async estoqueAtual(query: RelatorioQuery = {}) {
    const { categoria, produtoId, tipoMovimento } = query;
    const produtos = await this.prisma.produto.findMany({
      where: {
        ativo: true,
        ...(categoria ? { categoria: { nome: { contains: categoria, mode: 'insensitive' } } } : {}),
        ...(produtoId ? { id: produtoId } : {}),
      },
      include: { categoria: true },
      orderBy: { nome: 'asc' },
    });

    return Promise.all(
      produtos.map(async (p) => {
        const where: any = { produtoId: p.id };
        if (tipoMovimento) where.tipo = tipoMovimento;

        const resultado = await this.prisma.movimentacaoEstoque.aggregate({
          where,
          _sum: { quantidade: true },
        });

        const saldoAtual = Number(resultado._sum.quantidade ?? 0);
        const estoqueMinimo = p.estoqueMinimo ? Number(p.estoqueMinimo) : null;
        return {
          produtoId: p.id,
          codigoInterno: p.codigoInterno,
          nome: p.nome,
          categoria: p.categoria?.nome ?? null,
          saldoAtual,
          unidadeVenda: p.unidadeVenda,
          estoqueMinimo,
          abaixoMinimo: estoqueMinimo !== null && saldoAtual < estoqueMinimo,
        };
      }),
    );
  }

  async dashboard(query: RelatorioQuery = {}) {
    const base = this.buildPedidoWhere(query);

    const [totalVendas, totalPedidos, emAberto, vencidos, estoque] = await Promise.all([
      this.prisma.pedido.aggregate({ where: base, _sum: { totalFinal: true } }),
      this.prisma.pedido.count({ where: base }),
      this.prisma.pedido.aggregate({
        where: { ...base, statusPagamento: StatusPagamento.EM_ABERTO },
        _sum: { totalFinal: true },
      }),
      this.prisma.pedido.aggregate({
        where: { ...base, statusPagamento: StatusPagamento.VENCIDO },
        _sum: { totalFinal: true },
      }),
      this.estoqueAtual(query),
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

  async lucroDiario(query: RelatorioQuery = {}) {
    const base = this.buildPedidoWhere(query);

    const itens = await this.prisma.itemPedido.groupBy({
      by: ['produtoId'],
      where: { pedido: base },
      _sum: { quantidade: true, valorTotal: true },
      orderBy: { produtoId: 'asc' },
    });

    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: itens.map((item) => item.produtoId) } },
      select: { id: true, nome: true, categoria: true, custo: true },
    });

    const porProduto = itens
      .map((item) => {
        const produto = produtos.find((p) => p.id === item.produtoId);
        const nome = produto?.nome ?? item.produtoId;
        const quantidade = Number(item._sum.quantidade ?? 0);
        const faturamento = Number(item._sum.valorTotal ?? 0);
        const custoUnitario = Number(produto?.custo ?? 0);
        const custoTotal = custoUnitario * quantidade;
        const lucro = faturamento - custoTotal;

        return {
          produtoId: item.produtoId,
          produto: nome,
          quantidade,
          faturamento,
          custoTotal,
          lucro,
          margemPercentual: faturamento > 0 ? (lucro / faturamento) * 100 : 0,
        };
      })
      .sort((a, b) => b.faturamento - a.faturamento);

    const porTipoMorango = porProduto.filter((item) => /morango/i.test(item.produto));

    const resumo = itens.reduce(
      (acc, item) => {
        const produto = produtos.find((p) => p.id === item.produtoId);
        const quantidade = Number(item._sum.quantidade ?? 0);
        const faturamento = Number(item._sum.valorTotal ?? 0);
        const custoUnitario = Number(produto?.custo ?? 0);
        const custoTotal = custoUnitario * quantidade;

        acc.totalVendido += faturamento;
        acc.custoTotal += custoTotal;
        acc.quantidadeTotal += quantidade;
        return acc;
      },
      { totalVendido: 0, custoTotal: 0, quantidadeTotal: 0 },
    );

    const lucroTotal = resumo.totalVendido - resumo.custoTotal;

    return {
      periodo: {
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
      },
      geral: {
        totalVendido: resumo.totalVendido,
        custoTotal: resumo.custoTotal,
        lucroTotal,
        margemPercentual: resumo.totalVendido > 0 ? (lucroTotal / resumo.totalVendido) * 100 : 0,
        quantidadeTotal: resumo.quantidadeTotal,
      },
      porProduto,
      porTipoMorango,
    };
  }

  async gerarCsvVendas(query: RelatorioQuery = {}): Promise<string> {
    const pedidos = await this.vendasPorPeriodo(query);
    const linhas: string[] = [
      'Número,Data,Cliente,Vendedor,Subtotal,Frete,Desconto,Total,Pagamento,StatusPagamento,NF',
    ];

    for (const p of pedidos) {
      linhas.push(
        [
          p.numero,
          new Date(p.data).toLocaleDateString('pt-BR'),
          this.csvEscape(p.cliente?.razaoSocialOuNome ?? ''),
          this.csvEscape(p.vendedor?.nome ?? ''),
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

  async gerarCsvEstoque(query: RelatorioQuery = {}): Promise<string> {
    const itens = await this.estoqueAtual(query);
    const linhas: string[] = ['Produto,Código,Categoria,Saldo Atual,Unidade'];

    for (const item of itens) {
      linhas.push(
        [
          this.csvEscape(item.nome),
          this.csvEscape(item.codigoInterno ?? ''),
          this.csvEscape(item.categoria ?? ''),
          item.saldoAtual,
          item.unidadeVenda ?? '',
        ].join(','),
      );
    }

    return linhas.join('\n');
  }

  async gerarJsonVendas(query: RelatorioQuery = {}) {
    const dados = await this.vendasPorPeriodo(query);
    return JSON.stringify(dados, null, 2);
  }

  async gerarJsonEstoque(query: RelatorioQuery = {}) {
    const dados = await this.estoqueAtual(query);
    return JSON.stringify(dados, null, 2);
  }

  async gerarXmlVendas(query: RelatorioQuery = {}) {
    const dados = await this.vendasPorPeriodo(query);
    const itens = dados
      .map(
        (p) => `
      <pedido>
        <numero>${this.sanitizeString(String(p.numero)) ?? ''}</numero>
        <data>${new Date(p.data).toISOString()}</data>
        <cliente>${this.sanitizeString(p.cliente?.razaoSocialOuNome) ?? ''}</cliente>
        <vendedor>${this.sanitizeString(p.vendedor?.nome) ?? ''}</vendedor>
        <total>${Number(p.totalFinal ?? 0)}</total>
        <statusPagamento>${this.sanitizeString(p.statusPagamento) ?? ''}</statusPagamento>
      </pedido>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<relatorio>
  <tipo>vendas</tipo>
  <pedidos>${itens}</pedidos>
</relatorio>`;
  }

  async gerarXmlEstoque(query: RelatorioQuery = {}) {
    const dados = await this.estoqueAtual(query);
    const itens = dados
      .map(
        (item) => `
      <produto>
        <codigo>${this.sanitizeString(item.codigoInterno) ?? ''}</codigo>
        <nome>${this.sanitizeString(item.nome) ?? ''}</nome>
        <categoria>${this.sanitizeString(item.categoria) ?? ''}</categoria>
        <saldoAtual>${Number(item.saldoAtual ?? 0)}</saldoAtual>
      </produto>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<relatorio>
  <tipo>estoque</tipo>
  <produtos>${itens}</produtos>
</relatorio>`;
  }
}
