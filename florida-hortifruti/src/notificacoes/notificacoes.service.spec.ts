import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as webpush from 'web-push';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { NotificacoesService, TIPO_PEDIDO_A_CAMINHO } from './notificacoes.service';

vi.mock('web-push', () => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));

const ENV = { ...process.env };

describe('NotificacoesService', () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    prisma = criarPrismaMock();
    vi.mocked(webpush.sendNotification).mockReset();
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  const comPush = () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    return new NotificacoesService(prisma as any);
  };
  const semPush = () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    return new NotificacoesService(prisma as any);
  };

  it('chave pública só quando o push está ativo', () => {
    expect(semPush().chavePublica()).toEqual({ chavePublica: null });
    process.env.VAPID_SUBJECT = 'mailto:x@x';
    expect(comPush().chavePublica()).toEqual({ chavePublica: 'pub' });
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:x@x', 'pub', 'priv');
  });

  it('inscreve e cancela aparelho', async () => {
    const s = semPush();
    expect(
      await s.inscrever('u', { endpoint: 'e', keys: { p256dh: 'p', auth: 'a' } } as any),
    ).toEqual({ ok: true });
    expect(prisma.pushInscricao.upsert.mock.calls[0][0].where).toEqual({ endpoint: 'e' });
    expect(await s.cancelarInscricao('u', 'e')).toEqual({ ok: true });
  });

  const pedido = (extra: object = {}) => ({
    id: 'p',
    numero: 7,
    clienteId: 'c',
    cliente: { usuarioId: 'uc' },
    vendedor: { papel: 'VENDEDOR' },
    ...extra,
  });

  it('pedido a caminho: ignora sem cliente, revendedor e aviso repetido', async () => {
    const s = comPush();
    await s.pedidoACaminho('p');
    prisma.pedido.findUnique.mockResolvedValue(pedido({ vendedor: { papel: 'REVENDEDOR' } }));
    await s.pedidoACaminho('p');
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    prisma.notificacaoCliente.findFirst.mockResolvedValue({ id: 'n' });
    await s.pedidoACaminho('p');
    expect(prisma.notificacaoCliente.create).not.toHaveBeenCalled();
  });

  it('grava o aviso e manda push; limpa inscrição expirada', async () => {
    const s = comPush();
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    prisma.pushInscricao.findMany.mockResolvedValue([
      { id: 'i1', endpoint: 'e1', p256dh: 'p', auth: 'a' },
      { id: 'i2', endpoint: 'e2', p256dh: 'p', auth: 'a' },
      { id: 'i3', endpoint: 'e3', p256dh: 'p', auth: 'a' },
      { id: 'i4', endpoint: 'e4', p256dh: 'p', auth: 'a' },
    ]);
    vi.mocked(webpush.sendNotification)
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce(new Error('rede'));
    await s.pedidoACaminho('p');
    expect(prisma.notificacaoCliente.create.mock.calls[0][0].data).toMatchObject({
      tipo: TIPO_PEDIDO_A_CAMINHO,
      mensagem: expect.stringContaining('#7'),
    });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(4);
    expect(prisma.pushInscricao.deleteMany).toHaveBeenCalledWith({ where: { id: 'i2' } });
  });

  it('sem usuário do cliente ou sem push: só grava o aviso', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ cliente: null }));
    await comPush().pedidoACaminho('p');
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    await semPush().pedidoACaminho('p');
    expect(prisma.notificacaoCliente.create).toHaveBeenCalledTimes(2);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('erro nunca trava a entrega', async () => {
    prisma.pedido.findUnique.mockRejectedValue(new Error('banco fora'));
    await expect(comPush().pedidoACaminho('p')).resolves.toBeUndefined();
  });
});
