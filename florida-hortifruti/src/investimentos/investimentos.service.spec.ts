import { beforeEach, describe, expect, it } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { InvestimentosService } from './investimentos.service';

const inv = (valor: number, devolucoes: number[] = []) => ({
  id: 'i',
  nome: 'Marcelo',
  data: new Date('2026-11-01'),
  valor,
  motivo: 'caminhão',
  devolucoes: devolucoes.map((v, n) => ({
    id: `d${n}`,
    valor: v,
    data: new Date(`2026-11-0${n + 2}`),
    observacao: null,
  })),
});

describe('InvestimentosService', () => {
  let prisma: PrismaMock;
  let service: InvestimentosService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new InvestimentosService(prisma as any);
  });

  it('calcula situação de cada aporte', async () => {
    prisma.investimento.findMany.mockResolvedValue([inv(100), inv(100, [30]), inv(100, [60, 40])]);
    const [falta, parcial, devolvido] = await service.listar();
    expect(falta).toMatchObject({
      status: 'FALTA_DEVOLVER',
      valorRestante: 100,
      devolvidoEm: null,
    });
    expect(parcial).toMatchObject({ status: 'PARCIAL', valorRestante: 70, valorDevolvido: 30 });
    expect(devolvido.status).toBe('DEVOLVIDO');
    expect(devolvido.devolvidoEm).toEqual(new Date('2026-11-03'));
  });

  it('cria e atualiza sem ficar abaixo do devolvido', async () => {
    prisma.investimento.create.mockResolvedValue(inv(100));
    const criado = await service.criar({ nome: ' M ', valor: 100, motivo: ' x ' } as any, 'u');
    expect(criado.valor).toBe(100);
    expect(prisma.investimento.create.mock.calls[0][0].data).toMatchObject({
      nome: 'M',
      motivo: 'x',
    });

    const dto = (valor: number) => ({ nome: 'M', valor, motivo: 'x' }) as any;
    await expect(service.atualizar('i', dto(1))).rejects.toThrow('Investimento não encontrado');
    prisma.investimento.findUnique.mockResolvedValue(inv(100, [50]));
    await expect(service.atualizar('i', dto(40))).rejects.toThrow(
      'abaixo do que já foi devolvido (50.00)',
    );
    prisma.investimento.update.mockResolvedValue(inv(80, [50]));
    expect((await service.atualizar('i', dto(80))).valorRestante).toBe(30);
  });

  it('remove', async () => {
    prisma.investimento.findUnique.mockResolvedValue(inv(10));
    expect(await service.remover('i')).toEqual({ ok: true });
  });

  it('registra devolução até o que falta', async () => {
    prisma.investimento.findUnique.mockResolvedValue(inv(100, [70]));
    await expect(service.registrarDevolucao('i', { valor: 31 } as any, 'u')).rejects.toThrow(
      'passa do que falta devolver (30.00)',
    );
    await service.registrarDevolucao('i', { valor: 30, observacao: '  ' } as any, 'u');
    expect(prisma.devolucaoInvestimento.create.mock.calls[0][0].data.observacao).toBeNull();
    await service.registrarDevolucao('i', { valor: 10, observacao: ' pix ' } as any, 'u');
    expect(prisma.devolucaoInvestimento.create.mock.calls[1][0].data.observacao).toBe('pix');
  });

  it('remove devolução só do próprio aporte', async () => {
    await expect(service.removerDevolucao('i', 'd')).rejects.toThrow('Devolução não encontrada');
    prisma.devolucaoInvestimento.findUnique.mockResolvedValue({ id: 'd', investimentoId: 'outro' });
    await expect(service.removerDevolucao('i', 'd')).rejects.toThrow('Devolução não encontrada');
    prisma.devolucaoInvestimento.findUnique.mockResolvedValue({ id: 'd', investimentoId: 'i' });
    prisma.investimento.findUnique.mockResolvedValue(inv(100));
    expect((await service.removerDevolucao('i', 'd')).status).toBe('FALTA_DEVOLVER');
  });
});
