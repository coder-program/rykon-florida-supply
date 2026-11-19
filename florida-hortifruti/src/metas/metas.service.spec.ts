import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { MetasService } from './metas.service';

const dia = (d: string) => new Date(`${d}T00:00:00Z`);

describe('MetasService', () => {
  let prisma: PrismaMock;
  let service: MetasService;
  beforeEach(() => {
    // 18/11/2026, meio-dia em Brasília (quarta-feira)
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T15:00:00Z'));
    prisma = criarPrismaMock();
    service = new MetasService(prisma as any);
    for (const m of ['metaValor', 'metaDiaSemMeta', 'itemPedido', 'metaAbatimento']) {
      prisma[m].findMany.mockResolvedValue([]);
    }
  });
  afterEach(() => vi.useRealTimers());

  const comDados = () => {
    prisma.metaValor.findMany.mockResolvedValue([{ valor: 100, vigenteDesde: dia('2026-11-01') }]);
    prisma.metaDiaSemMeta.findMany.mockResolvedValue([
      { data: dia('2026-11-03'), motivo: 'feriado' },
    ]);
    prisma.metaAbatimento.findMany.mockResolvedValue([
      { data: dia('2026-11-04'), batida: false, valor: 30, motivo: 'chuva' },
    ]);
    prisma.itemPedido.findMany.mockResolvedValue([
      // 02/11 23h em Brasília (03/11 UTC) conta no dia 02
      {
        quantidade: 2,
        valorTotal: 200,
        pedido: { data: new Date('2026-11-03T02:00:00Z') },
        produto: { custo: 40 },
      },
      {
        quantidade: 1,
        valorTotal: 50,
        pedido: { data: new Date('2026-11-02T15:00:00Z') },
        produto: { custo: null },
      },
      {
        quantidade: 1,
        valorTotal: 80,
        pedido: { data: new Date('2026-11-18T13:00:00Z') },
        produto: { custo: 0 },
      },
    ]);
  };

  it('mês: valida formato e mês futuro vem vazio', async () => {
    await expect(service.mes('2026-1')).rejects.toThrow('AAAA-MM');
    expect(await service.mes('2027-01')).toMatchObject({
      dias: [],
      resumo: { diasComMeta: 0, diasAtingidos: 0, lucroTotal: 0 },
    });
  });

  it('mês atual: lucro por dia de Brasília, motivos e resumo', async () => {
    comDados();
    const r = await service.mes();
    expect(r.mes).toBe('2026-11');
    expect(r.hoje).toBe('2026-11-18');
    expect(r.dias.at(-1)?.data).toBe('2026-11-18');
    const d2 = r.dias.find((d) => d.data === '2026-11-02')!;
    expect(d2.lucro).toBe(170);
    expect(r.dias.find((d) => d.data === '2026-11-03')?.motivo).toBe('feriado');
    expect(r.dias.find((d) => d.data === '2026-11-04')?.motivoAbatimento).toBe('chuva');
    expect(r.resumo.lucroTotal).toBe(250);
    expect(r.resumo.diasComMeta).toBeGreaterThan(0);

    const passado = await service.mes('2026-10');
    expect(passado.dias.at(-1)?.data).toBe('2026-10-31');
  });

  it('hoje: vendedor vê só o progresso', async () => {
    comDados();
    const vend = await service.hoje('VENDEDOR');
    expect(vend).toEqual({
      data: '2026-11-18',
      temMeta: true,
      motivoSemMeta: null,
      percentual: expect.any(Number),
      atingida: expect.any(Boolean),
      temAcumulado: expect.any(Boolean),
    });
    const adm: any = await service.hoje('ADMINISTRADOR');
    expect(adm).toMatchObject({ data: '2026-11-18', lucro: 80 });
    expect(adm.meta).toBeGreaterThan(0);
  });

  it('hoje sem meta definida', async () => {
    const vend = await service.hoje('VENDEDOR');
    expect(vend).toMatchObject({ temMeta: false, percentual: 0, temAcumulado: false });
    expect((await service.hoje('ADMINISTRADOR')).percentual).toBe(0);
  });

  it('valores: lista, define (substitui no mesmo dia) e remove', async () => {
    prisma.metaValor.findMany.mockResolvedValue([
      { id: 'v', valor: '100', vigenteDesde: dia('2026-11-01'), criadoEm: 'c' },
    ]);
    expect(await service.valores()).toEqual([
      { id: 'v', valor: 100, vigenteDesde: '2026-11-01', criadoEm: 'c' },
    ]);

    await service.definirValor({ valor: 120 } as any, 'u');
    expect(prisma.metaValor.create.mock.calls[0][0].data).toEqual({
      valor: 120,
      vigenteDesde: dia('2026-11-18'),
      criadoPorId: 'u',
    });
    prisma.metaValor.findFirst.mockResolvedValue({ id: 'v' });
    await service.definirValor({ valor: 150, vigenteDesde: '2026-11-01' } as any, 'u');
    expect(prisma.metaValor.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'v' },
      data: { valor: 150 },
    });

    await service.removerValor('v');
    expect(prisma.metaValor.deleteMany).toHaveBeenCalledWith({ where: { id: 'v' } });
  });

  it('dias sem meta', async () => {
    await expect(service.diasSemMeta('nov')).rejects.toThrow('AAAA-MM');
    prisma.metaDiaSemMeta.findMany.mockResolvedValue([{ data: dia('2026-11-03'), motivo: 'x' }]);
    expect(await service.diasSemMeta()).toEqual([{ data: '2026-11-03', motivo: 'x' }]);
    await service.diasSemMeta('2026-02');
    expect(prisma.metaDiaSemMeta.findMany.mock.calls[1][0].where.data.lte).toEqual(
      dia('2026-02-28'),
    );

    expect(await service.marcarDiaSemMeta({ data: '2026-11-03' } as any)).toEqual({ ok: true });
    expect(prisma.metaDiaSemMeta.upsert.mock.calls[0][0].create.motivo).toBeNull();
    await service.marcarDiaSemMeta({ data: '2026-11-03', motivo: 'feriado' } as any);
    expect(prisma.metaDiaSemMeta.upsert.mock.calls[1][0].update.motivo).toBe('feriado');
    expect(await service.desmarcarDiaSemMeta('2026-11-03')).toEqual({ ok: true });
  });

  it('abater meta', async () => {
    await expect(
      service.abater({ data: '2026-11-19', motivo: 'x', batida: true } as any, 'u'),
    ).rejects.toThrow('dia futuro');
    await expect(service.abater({ data: '2026-11-18', motivo: 'x' } as any, 'u')).rejects.toThrow(
      'Marque como batida',
    );
    await expect(
      service.abater({ data: '2026-11-18', motivo: 'x', valor: 0 } as any, 'u'),
    ).rejects.toThrow();

    await service.abater({ data: '2026-11-18', motivo: ' chuva ', valor: 25 } as any, 'u');
    expect(prisma.metaAbatimento.upsert.mock.calls[0][0].update).toMatchObject({
      batida: false,
      valor: 25,
      motivo: 'chuva',
    });
    await service.abater({ data: '2026-11-17', motivo: 'x', batida: true, valor: 99 } as any, 'u');
    expect(prisma.metaAbatimento.upsert.mock.calls[1][0].create).toMatchObject({
      batida: true,
      valor: 0,
    });

    expect(await service.removerAbatimento('2026-11-17', 'u')).toEqual({ ok: true });
    expect(prisma.logAuditoria.create.mock.calls.at(-1)?.[0].data.acao).toBe(
      'REMOVER_ABATIMENTO_META',
    );
  });
});
