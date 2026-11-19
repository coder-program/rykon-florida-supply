import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { FinanceiroService } from './financeiro.service';

const AGORA = new Date('2026-11-18T15:00:00Z');
const emDias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000);

describe('FinanceiroService', () => {
  let prisma: PrismaMock;
  let service: FinanceiroService;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AGORA);
    prisma = criarPrismaMock();
    service = new FinanceiroService(prisma as any);
  });
  afterEach(() => vi.useRealTimers());

  it('resumo: recebido, em aberto, vencido e a vencer pelo saldo', async () => {
    prisma.pagamentoPedido.aggregate.mockResolvedValue({
      _sum: { valor: null },
      _count: { id: 0 },
    });
    prisma.pedido.findMany.mockResolvedValue([
      { totalFinal: 100, dataVencimento: emDias(-2), pagamentos: [{ valor: 40 }] },
      { totalFinal: 50, dataVencimento: emDias(3), pagamentos: [] },
      { totalFinal: 70, dataVencimento: emDias(20), pagamentos: [] },
      { totalFinal: 30, dataVencimento: null, pagamentos: [] },
      { totalFinal: 10, dataVencimento: emDias(-1), pagamentos: [{ valor: 10 }] },
    ]);
    const r = await service.resumo();
    expect(r).toEqual({
      recebido: { total: 0, qtd: 0 },
      emAberto: { total: 210, qtd: 4 },
      vencido: { total: 60, qtd: 1 },
      aVencer7dias: { total: 50, qtd: 1 },
    });
    expect(prisma.pagamentoPedido.aggregate.mock.calls[0][0].where.data).toBeUndefined();

    prisma.pagamentoPedido.aggregate.mockResolvedValue({ _sum: { valor: 99 }, _count: { id: 2 } });
    prisma.pedido.findMany.mockResolvedValue([]);
    expect((await service.resumo('2026-11-01', '2026-11-30')).recebido).toEqual({
      total: 99,
      qtd: 2,
    });
    expect(prisma.pagamentoPedido.aggregate.mock.calls[1][0].where.data.gte).toEqual(
      new Date('2026-11-01'),
    );
    await service.resumo(undefined, '2026-11-30');
    expect(prisma.pagamentoPedido.aggregate.mock.calls[2][0].where.data.gte).toBeUndefined();
  });

  it('contas a receber: filtros por situação e período', async () => {
    prisma.pedido.findMany.mockResolvedValue([]);
    const where = async (f: object) => {
      await service.contasAReceber(f as any);
      return prisma.pedido.findMany.mock.calls.at(-1)![0].where;
    };
    expect(await where({ vendedorId: 'v', clienteId: 'c', formaPagamento: 'PIX' })).toMatchObject({
      vendedorId: 'v',
      clienteId: 'c',
      formaPagamento: 'PIX',
    });
    expect((await where({ dataInicio: '2026-11-01' })).data.lte).toBeUndefined();
    expect((await where({ dataFim: '2026-11-30' })).data.gte).toBeUndefined();
    expect((await where({ situacao: 'PAGO' })).statusPagamento).toBe('PAGO');
    expect((await where({ situacao: 'VENCIDO' })).dataVencimento).toEqual({ lt: AGORA });
    expect((await where({ situacao: 'A_VENCER' })).dataVencimento.lte).toEqual(emDias(7));
    expect((await where({ situacao: 'EM_ABERTO' })).dataVencimento).toBeUndefined();
    expect((await where({ situacao: 'PAGO_PARCIAL' })).pagamentos).toBeDefined();
  });

  it('contas a receber: situação calculada e saldo', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      {
        statusPagamento: 'EM_ABERTO',
        dataVencimento: emDias(-1),
        totalFinal: 100,
        pagamentos: [{ valor: 30 }],
      },
      { statusPagamento: 'EM_ABERTO', dataVencimento: emDias(2), totalFinal: 100, pagamentos: [] },
      { statusPagamento: 'EM_ABERTO', dataVencimento: emDias(30), totalFinal: 100, pagamentos: [] },
      { statusPagamento: 'EM_ABERTO', dataVencimento: null, totalFinal: 100, pagamentos: [] },
      {
        statusPagamento: 'PAGO',
        dataVencimento: emDias(-5),
        totalFinal: 100,
        pagamentos: [{ valor: 100 }],
      },
    ]);
    const r = await service.contasAReceber({});
    expect(r.map((p) => p.situacaoCalculada)).toEqual([
      'VENCIDO',
      'A_VENCER',
      'EM_ABERTO',
      'EM_ABERTO',
      'PAGO',
    ]);
    expect(r[0]).toMatchObject({ valorPago: 30, saldoDevedor: 70 });
    expect(r[4].saldoDevedor).toBe(0);
  });

  it('reabrir estorna os pagamentos e registra na auditoria', async () => {
    prisma.pagamentoPedido.findMany.mockResolvedValue([
      { valor: '50', data: 'd', formaPagamento: 'PIX' },
    ]);
    prisma.pedido.update.mockReturnValue({ id: 'p' });
    expect(await service.reabrir('p', 'u')).toEqual({ id: 'p' });
    expect(prisma.logAuditoria.create.mock.calls[0][0].data.detalhes).toEqual({
      pagamentosEstornados: [{ valor: 50, data: 'd', formaPagamento: 'PIX' }],
    });
  });

  const pedido = (extra: object = {}) => ({
    id: 'p',
    vendedorId: 'v',
    statusPagamento: 'EM_ABERTO',
    formaPagamento: 'PIX',
    totalFinal: 100,
    pagamentos: [{ valor: 40 }],
    ...extra,
  });

  it('registrar pagamento: validações', async () => {
    await expect(service.registrarPagamento('p', { valor: 1 }, 'u')).rejects.toThrow(
      'Pedido não encontrado',
    );
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    await expect(
      service.registrarPagamento('p', { valor: 1 }, 'outro', 'VENDEDOR'),
    ).rejects.toThrow('só pode registrar pagamento dos seus pedidos');
    await expect(service.registrarPagamento('p', { valor: 0 }, 'u')).rejects.toThrow(
      'valor de pagamento válido',
    );
    await expect(service.registrarPagamento('p', { valor: 61 }, 'u')).rejects.toThrow(
      'maior que o saldo devedor (60.00)',
    );
    await expect(service.registrarPagamento('p', { valor: 10 }, 'v', 'VENDEDOR')).rejects.toThrow(
      'apenas o pagamento total',
    );
    prisma.pedido.findUnique.mockResolvedValue(pedido({ statusPagamento: 'PAGO' }));
    await expect(service.registrarPagamento('p', { valor: 1 }, 'u')).rejects.toThrow(
      'já está quitado',
    );
  });

  it('registrar pagamento parcial e quitação', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    prisma.pagamentoPedido.create.mockImplementation(async ({ data }: any) => data);
    prisma.pedido.update.mockResolvedValue({ id: 'p' });

    const parcial = await service.registrarPagamento(
      'p',
      { valor: 20, observacao: 'x' },
      'u',
      'ADMINISTRATIVO',
    );
    expect(parcial.saldoDevedor).toBe(40);
    expect(prisma.pedido.update.mock.calls[0][0].data.statusPagamento).toBe('EM_ABERTO');
    expect(prisma.pagamentoPedido.create.mock.calls[0][0].data.formaPagamento).toBe('PIX');
    expect(prisma.notificacaoCliente.updateMany).not.toHaveBeenCalled();

    const total = await service.registrarPagamento(
      'p',
      { valor: 60, formaPagamento: 'DINHEIRO' },
      'v',
      'VENDEDOR',
    );
    expect(total.saldoDevedor).toBe(0);
    expect(prisma.pedido.update.mock.calls[1][0].data.statusPagamento).toBe('PAGO');
    expect(prisma.notificacaoCliente.updateMany).toHaveBeenCalled();
  });

  it('marcar pago', async () => {
    await expect(service.marcarPago('p', 'u')).rejects.toThrow('Pedido não encontrado');
    prisma.pedido.findUnique.mockResolvedValue(pedido({ statusPagamento: 'PAGO' }));
    expect(await service.marcarPago('p', 'u')).toMatchObject({ statusPagamento: 'PAGO' });

    // Já coberto por pagamentos parciais: só muda o status
    prisma.pedido.findUnique.mockResolvedValue(pedido({ pagamentos: [{ valor: 100 }] }));
    prisma.pedido.update.mockReturnValue({ id: 'p', statusPagamento: 'PAGO' });
    await service.marcarPago('p', 'u');
    expect(prisma.logAuditoria.create.mock.calls[0][0].data.acao).toBe('MARCAR_PAGO');

    prisma.pedido.findUnique.mockResolvedValue(pedido());
    prisma.pagamentoPedido.create.mockImplementation(async ({ data }: any) => data);
    prisma.pedido.update.mockResolvedValue({ id: 'p', formaPagamento: 'PIX' });
    expect(await service.marcarPago('p', 'u')).toEqual({ id: 'p', formaPagamento: 'PIX' });
    expect(prisma.pagamentoPedido.create.mock.calls[0][0].data).toMatchObject({
      valor: 60,
      observacao: 'Quitação total',
    });

    // Quitado com outra forma: a forma do pedido passa a ser essa
    await service.marcarPago('p', 'u', 'ADMINISTRATIVO', undefined, 'DINHEIRO');
    expect(prisma.pedido.update.mock.calls.at(-1)![0].data).toEqual({ formaPagamento: 'DINHEIRO' });
  });

  it('avisos de vencimento: 3 dias antes e no dia, sem repetir', async () => {
    const hoje = new Date('2026-11-18T00:00:00Z');
    const venc = (dias: number) => new Date(hoje.getTime() + dias * 86_400_000);
    const p = (id: string, extra: object) => ({
      id,
      clienteId: 'c',
      data: AGORA,
      totalFinal: 100,
      pagamentos: [],
      cliente: { id: 'c', razaoSocialOuNome: 'Mercado' },
      vendedor: { papel: 'VENDEDOR' },
      ...extra,
    });
    prisma.pedido.findMany.mockResolvedValue([
      p('hoje', { dataVencimento: venc(0) }),
      p('tres', { dataVencimento: venc(3) }),
      p('vencido', { dataVencimento: venc(-2) }),
      p('cinco', { dataVencimento: venc(5) }),
      p('quitado', { dataVencimento: venc(0), pagamentos: [{ valor: 100 }] }),
      p('revenda', { dataVencimento: venc(0), vendedor: { papel: 'REVENDEDOR' } }),
      p('semCliente', { dataVencimento: venc(0), cliente: null }),
      p('semData', { dataVencimento: null }),
      p('jaAvisado', { dataVencimento: venc(3) }),
    ]);
    prisma.notificacaoCliente.findFirst.mockImplementation(async ({ where }: any) =>
      where.pedidoId === 'jaAvisado' ? { id: 'n' } : null,
    );
    prisma.notificacaoCliente.create.mockImplementation(async ({ data }: any) => data);
    const r = await service.executarNotificacoesDiarias();
    expect(r.map((n: any) => [n.pedidoId, n.tipo, n.titulo])).toEqual([
      ['hoje', 'VENCIMENTO_HOJE', 'Pagamento vence hoje'],
      ['tres', 'VENCE_EM_3_DIAS', 'Pagamento vence em 3 dias'],
      ['vencido', 'VENCIMENTO_HOJE', 'Pagamento vencido'],
    ]);
  });

  it('lista avisos e marca como enviado', async () => {
    await service.listarNotificacoes({});
    expect(prisma.notificacaoCliente.findMany.mock.calls[0][0].where).toEqual({
      tipo: { not: 'PEDIDO_A_CAMINHO' },
    });
    await service.listarNotificacoes({ status: 'PENDENTE', clienteId: 'c' });
    expect(prisma.notificacaoCliente.findMany.mock.calls[1][0].where).toMatchObject({
      status: 'PENDENTE',
      clienteId: 'c',
    });

    await expect(service.marcarNotificacaoEnviada('n')).rejects.toThrow('Aviso não encontrado');
    prisma.notificacaoCliente.findUnique.mockResolvedValue({ status: 'CANCELADA' });
    await expect(service.marcarNotificacaoEnviada('n')).rejects.toThrow('já foi pago');
    prisma.notificacaoCliente.findUnique.mockResolvedValue({ status: 'PENDENTE' });
    await service.marcarNotificacaoEnviada('n');
    expect(prisma.notificacaoCliente.update.mock.calls[0][0].data.status).toBe('ENVIADA');
  });
});
