import { beforeEach, describe, expect, it } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { RelatoriosService } from './relatorios.service';

const PEDIDO = {
  numero: 7,
  data: new Date('2026-11-07T15:00:00Z'),
  cliente: { razaoSocialOuNome: 'Frutas & "Cia" <SP>' },
  vendedor: { nome: 'Cesar' },
  subtotal: 100,
  valorFrete: 10,
  descontoValor: 0,
  totalFinal: 110,
  formaPagamento: 'PIX',
  statusPagamento: 'PAGO',
  necessitaNF: true,
};

describe('RelatoriosService', () => {
  let prisma: PrismaMock;
  let service: RelatoriosService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new RelatoriosService(prisma as any);
    prisma.pedido.findMany.mockResolvedValue([]);
    prisma.produto.findMany.mockResolvedValue([]);
  });

  const ultimoWhere = () => prisma.pedido.findMany.mock.calls.at(-1)![0].where;

  it('filtros de pedido: status, pagamento, vendedor e período', async () => {
    await service.vendasPorPeriodo();
    expect(ultimoWhere()).toEqual({ status: { notIn: ['CANCELADO', 'REJEITADO'] } });

    await service.vendasPorPeriodo({ status: 'TODOS', statusPagamento: 'TODOS' });
    expect(ultimoWhere().statusPagamento).toBeUndefined();

    await service.vendasPorPeriodo({
      status: 'ENTREGUE',
      statusPagamento: 'PAGO_PARCIAL',
      vendedorId: 'v',
      produtoId: 'p',
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30',
    });
    const w = ultimoWhere();
    expect(w).toMatchObject({ status: 'ENTREGUE', statusPagamento: 'EM_ABERTO', vendedorId: 'v' });
    expect(w.itens).toEqual({ some: { produtoId: 'p' } });
    expect(w.data.gte.getDate()).toBe(1);
    expect(w.data.lte.getHours()).toBe(23);

    await service.vendasPorPeriodo({ statusPagamento: 'PAGO', dataInicio: '2026-11-01T10:00:00Z' });
    expect(ultimoWhere()).toMatchObject({ statusPagamento: 'PAGO' });
    expect(ultimoWhere().data.lte).toBeUndefined();
    await service.vendasPorPeriodo({ dataInicio: '2026' });
    expect(ultimoWhere().data.gte).toEqual(new Date('2026'));
  });

  it('vendas por vendedor e por produto', async () => {
    prisma.pedido.groupBy.mockResolvedValue([
      { vendedorId: 'v', _sum: { totalFinal: 100 }, _count: { id: 2 } },
      { vendedorId: null, _sum: { totalFinal: null }, _count: { id: 1 } },
    ]);
    prisma.usuario.findMany.mockResolvedValue([{ id: 'v', nome: 'Cesar' }]);
    expect(await service.vendasPorVendedor()).toEqual([
      { vendedor: 'Cesar', totalPedidos: 2, totalVendido: 100 },
      { vendedor: null, totalPedidos: 1, totalVendido: 0 },
    ]);

    prisma.itemPedido.groupBy.mockResolvedValue([
      { produtoId: 'a', _sum: { quantidade: 3, valorTotal: 90 }, _avg: { valorUnitario: 30 } },
      { produtoId: 'x', _sum: {}, _avg: {} },
    ]);
    prisma.produto.findMany.mockResolvedValue([
      { id: 'a', nome: 'Morango', codigoInterno: 'M', custo: 20 },
    ]);
    const r = await service.vendasPorProduto({ produtoId: 'a' });
    expect(r[0]).toMatchObject({ produto: 'Morango', faturamento: 90, custoMedio: 20 });
    expect(r[1]).toMatchObject({
      produto: 'x',
      quantidadeVendida: 0,
      faturamento: 0,
      precoMedioVenda: 0,
      custoMedio: null,
    });
    expect(prisma.itemPedido.groupBy.mock.calls[0][0].where.produtoId).toBe('a');
    await service.vendasPorProduto();
    expect(prisma.itemPedido.groupBy.mock.calls[1][0].where.produtoId).toBeUndefined();
  });

  it('financeiro', async () => {
    prisma.pedido.aggregate
      .mockResolvedValueOnce({ _sum: { totalFinal: 10 }, _count: { id: 1 } })
      .mockResolvedValueOnce({ _sum: { totalFinal: null }, _count: { id: 0 } })
      .mockResolvedValueOnce({ _sum: { totalFinal: 5 }, _count: { id: 2 } });
    expect(await service.financeiro()).toEqual({
      pagos: { total: 10, quantidade: 1 },
      emAberto: { total: 0, quantidade: 0 },
      vencidos: { total: 5, quantidade: 2 },
    });
  });

  it('estoque atual com mínimo', async () => {
    prisma.produto.findMany.mockResolvedValue([
      {
        id: 'a',
        codigoInterno: 'M',
        nome: 'Morango',
        categoria: { nome: 'Frutas' },
        unidadeVenda: 'CX',
        estoqueMinimo: 10,
      },
      {
        id: 'b',
        codigoInterno: null,
        nome: 'Uva',
        categoria: null,
        unidadeVenda: null,
        estoqueMinimo: null,
      },
    ]);
    prisma.movimentacaoEstoque.aggregate
      .mockResolvedValueOnce({ _sum: { quantidade: 5 } })
      .mockResolvedValueOnce({ _sum: { quantidade: null } });
    const r = await service.estoqueAtual({
      categoria: 'fru',
      produtoId: 'a',
      tipoMovimento: 'ENTRADA',
    });
    expect(r).toEqual([
      expect.objectContaining({
        saldoAtual: 5,
        estoqueMinimo: 10,
        abaixoMinimo: true,
        categoria: 'Frutas',
      }),
      expect.objectContaining({
        saldoAtual: 0,
        estoqueMinimo: null,
        abaixoMinimo: false,
        categoria: null,
      }),
    ]);
    expect(prisma.produto.findMany.mock.calls[0][0].where).toMatchObject({ id: 'a' });
    expect(prisma.movimentacaoEstoque.aggregate.mock.calls[0][0].where.tipo).toBe('ENTRADA');
  });

  it('dashboard: totais, status e devoluções', async () => {
    prisma.pedido.aggregate.mockResolvedValue({ _sum: { totalFinal: null } });
    prisma.pedido.count.mockResolvedValue(3);
    prisma.pedido.groupBy.mockResolvedValue([{ status: 'ENTREGUE', _count: { id: 2 } }]);
    prisma.itemPedido.aggregate.mockResolvedValue({ _sum: { quantidade: 12 } });
    prisma.logAuditoria.findMany.mockResolvedValue([
      { detalhes: { status: 'CONCLUIDA', quantidadeCaixas: 2, valorDevolucao: 50 } },
      { detalhes: { status: 'APROVADA', quantidadeCaixas: 'x', valorDevolucao: -1 } },
      { detalhes: { status: 'NEGADA' } },
      { detalhes: { status: 'OUTRO' } },
      { detalhes: null },
    ]);
    const r = await service.dashboard({ dataInicio: '2026-11-01' });
    expect(r).toMatchObject({ totalVendas: 0, totalPedidos: 3, caixasVendidas: 12 });
    expect(r.porStatus.ENTREGUE).toBe(2);
    expect(r.devolucoes).toEqual({
      total: 5,
      pendentes: 2,
      aprovadas: 1,
      concluidas: 1,
      negadas: 1,
      totalCaixas: 2,
      valorTotal: 50,
    });
    expect(prisma.logAuditoria.findMany.mock.calls[0][0].where.data).toBeDefined();

    prisma.itemPedido.aggregate.mockResolvedValue({ _sum: { quantidade: null } });
    prisma.pedido.aggregate.mockResolvedValue({ _sum: { totalFinal: 9 } });
    const sem = await service.dashboard();
    expect(sem).toMatchObject({ totalVendas: 9, caixasVendidas: 0, valoresEmAberto: 9 });
    expect(prisma.pedido.groupBy.mock.calls[1][0].where).toBeUndefined();
  });

  it('lucro diário com perdas e morangos', async () => {
    prisma.itemPedido.groupBy.mockResolvedValue([
      { produtoId: 'a', _sum: { quantidade: 2, valorTotal: 100 } },
      { produtoId: 'b', _sum: { quantidade: 1, valorTotal: 300 } },
      { produtoId: 'x', _sum: {} },
    ]);
    prisma.produto.findMany.mockResolvedValue([
      { id: 'a', nome: 'Morango B3', custo: 30 },
      { id: 'b', nome: 'Uva', custo: null },
    ]);
    prisma.perdaDevolucao.aggregate.mockResolvedValue({ _sum: { valor: 10 } });
    const r = await service.lucroDiario({ dataInicio: '2026-11-01', vendedorId: 'v' });
    expect(r.porProduto.map((p) => p.produto)).toEqual(['Uva', 'Morango B3', 'x']);
    expect(r.porTipoMorango).toHaveLength(1);
    expect(r.porProduto[1]).toMatchObject({ custoTotal: 60, lucro: 40, margemPercentual: 40 });
    expect(r.porProduto[2].margemPercentual).toBe(0);
    expect(r.geral).toMatchObject({
      totalVendido: 400,
      custoTotal: 60,
      perdas: 10,
      lucroTotal: 330,
    });
    expect(prisma.perdaDevolucao.aggregate.mock.calls[0][0].where).toMatchObject({
      pedido: { vendedorId: 'v' },
    });

    prisma.itemPedido.groupBy.mockResolvedValue([]);
    prisma.perdaDevolucao.aggregate.mockResolvedValue({ _sum: { valor: null } });
    const vazio = await service.lucroDiario();
    expect(vazio.geral).toMatchObject({ totalVendido: 0, perdas: 0, margemPercentual: 0 });
    expect(prisma.perdaDevolucao.aggregate.mock.calls[1][0].where).toEqual({});
  });

  it('lotes e lucro por lote', async () => {
    prisma.loteProduto.findMany.mockResolvedValue([
      {
        id: 'l',
        numero: '77',
        dataEntrada: 'd',
        produtoId: 'a',
        valorUnitario: '20',
        quantidadeInicial: '10',
        quantidadeDisponivel: '4',
        produto: { nome: 'Morango' },
      },
    ]);
    expect(await service.lotesParaLucro()).toEqual([
      {
        id: 'l',
        numero: '77',
        dataEntrada: 'd',
        produtoId: 'a',
        custoUnitario: 20,
        produto: 'Morango',
        quantidadeInicial: 10,
        quantidadeDisponivel: 4,
      },
    ]);

    await expect(service.lucroPorLote('l')).rejects.toThrow('Lote não encontrado');
    prisma.loteProduto.findUnique.mockResolvedValue({
      id: 'l',
      numero: '77',
      dataEntrada: 'd',
      valorUnitario: 20,
      quantidadeInicial: 10,
      quantidadeDisponivel: 4,
      produto: { nome: 'Morango' },
    });
    prisma.itemPedidoLote.findMany.mockResolvedValue([
      {
        quantidade: 2,
        valorTotal: 60,
        valorUnitario: 30,
        pedido: { id: 'p', numero: 1, data: 'd', cliente: { razaoSocialOuNome: 'M' } },
      },
      {
        quantidade: 1,
        valorTotal: 25,
        valorUnitario: 25,
        pedido: { id: 'q', numero: 2, data: 'd', cliente: null },
      },
    ]);
    prisma.perdaDevolucao.aggregate.mockResolvedValue({ _sum: { valor: 5 } });
    const r = await service.lucroPorLote('l');
    expect(r.lote.custoLote).toBe(200);
    expect(r.geral).toMatchObject({
      totalVendido: 85,
      custoTotal: 60,
      perdas: 5,
      lucroTotal: 20,
      quantidadeTotal: 3,
    });
    expect(r.vendas[1].cliente).toBeNull();

    prisma.itemPedidoLote.findMany.mockResolvedValue([]);
    prisma.perdaDevolucao.aggregate.mockResolvedValue({ _sum: {} });
    expect((await service.lucroPorLote('l')).geral).toMatchObject({
      precoMedio: 0,
      margemPercentual: 0,
      perdas: 0,
    });
  });

  it('exportações de vendas: CSV, JSON e XML', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      PEDIDO,
      {
        ...PEDIDO,
        cliente: null,
        vendedor: null,
        necessitaNF: false,
        totalFinal: null,
        statusPagamento: null,
      },
    ]);
    const csv = await service.gerarCsvVendas();
    expect(csv.split('\n')[1]).toContain('"Frutas & ""Cia"" <SP>","Cesar"');
    expect(csv.split('\n')[1]).toMatch(/,Sim$/);
    expect(csv.split('\n')[2]).toMatch(/"","",.*,Não$/);

    expect(JSON.parse(await service.gerarJsonVendas())).toHaveLength(2);

    const xml = await service.gerarXmlVendas();
    expect(xml).toContain('<cliente>Frutas &amp; "Cia" &lt;SP&gt;</cliente>');
    expect(xml).toContain('<cliente></cliente>');
    expect(xml).toContain('<total>0</total>');
  });

  it('exportações de estoque: CSV, JSON e XML', async () => {
    prisma.produto.findMany.mockResolvedValue([
      {
        id: 'a',
        codigoInterno: 'M',
        nome: 'Morango',
        categoria: { nome: 'Frutas' },
        unidadeVenda: 'CX',
        estoqueMinimo: null,
      },
      {
        id: 'b',
        codigoInterno: null,
        nome: 'Uva',
        categoria: null,
        unidadeVenda: null,
        estoqueMinimo: null,
      },
    ]);
    prisma.movimentacaoEstoque.aggregate.mockResolvedValue({ _sum: { quantidade: 3 } });
    const csv = await service.gerarCsvEstoque();
    expect(csv.split('\n')).toEqual([
      'Produto,Código,Categoria,Saldo Atual,Unidade',
      '"Morango","M","Frutas",3,CX',
      '"Uva","","",3,',
    ]);
    expect(JSON.parse(await service.gerarJsonEstoque())).toHaveLength(2);
    const xml = await service.gerarXmlEstoque();
    expect(xml).toContain('<codigo>M</codigo>');
    expect(xml).toContain('<codigo></codigo>');
  });
});
