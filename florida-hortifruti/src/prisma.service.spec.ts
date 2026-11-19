import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

// Captura o middleware de reconexão sem abrir conexão com o banco
let middleware: (params: any, next: (p: any) => Promise<any>) => Promise<any>;

describe('PrismaService', () => {
  beforeEach(() => {
    process.env.PRISMA_RETRY_DELAY_MS = '0';
    process.env.PRISMA_RETRY_MAX = '2';
    vi.spyOn(PrismaClient.prototype as any, '$use').mockImplementation((fn: any) => {
      middleware = fn;
    });
    vi.spyOn(PrismaClient.prototype as any, '$connect').mockResolvedValue(undefined);
    vi.spyOn(PrismaClient.prototype as any, '$disconnect').mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PRISMA_RETRY_DELAY_MS;
    delete process.env.PRISMA_RETRY_MAX;
  });

  it('leitura tenta de novo até o limite', async () => {
    new PrismaService();
    const next = vi.fn().mockRejectedValueOnce(new Error('qualquer')).mockResolvedValue('ok');
    expect(await middleware({ action: 'findMany' }, next)).toBe('ok');

    const sempreFalha = vi.fn().mockRejectedValue(new Error('x'));
    await expect(middleware({ action: 'findMany' }, sempreFalha)).rejects.toThrow('x');
    expect(sempreFalha).toHaveBeenCalledTimes(3);
  });

  it('escrita só tenta de novo em erro de conexão', async () => {
    new PrismaService();
    const erroComum = vi.fn().mockRejectedValue({ code: 'P2002', message: 'unique' });
    await expect(middleware({ action: 'create' }, erroComum)).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(erroComum).toHaveBeenCalledTimes(1);

    for (const erro of [
      { code: 'ECONNRESET' },
      { code: 'P1008' },
      { message: 'Server has closed the connection' },
      { message: 'Connection terminated unexpectedly' },
      { message: 'connect ECONNRESET 1.2.3.4' },
      { message: 'the database closed the connection' },
      { message: 'Connection pool timeout' },
      {},
    ]) {
      const next = vi.fn().mockRejectedValueOnce(erro).mockResolvedValue('ok');
      const r = middleware({ action: 'update' }, next);
      if (erro.code || erro.message) expect(await r).toBe('ok');
      else await expect(r).rejects.toEqual({});
    }
  });

  it('usa os padrões sem variáveis de ambiente', async () => {
    delete process.env.PRISMA_RETRY_MAX;
    process.env.PRISMA_RETRY_DELAY_MS = '0';
    new PrismaService();
    const falha = vi.fn().mockRejectedValue(new Error('x'));
    await expect(middleware({ action: 'count' }, falha)).rejects.toThrow();
    expect(falha).toHaveBeenCalledTimes(4);
  });

  it('conecta, reconecta e desconecta', async () => {
    const s = new PrismaService();
    await s.onModuleInit();
    vi.mocked(PrismaClient.prototype.$connect).mockRejectedValueOnce(new Error('fora'));
    vi.mocked(PrismaClient.prototype.$disconnect).mockRejectedValueOnce(new Error('já caiu'));
    await expect(s.onModuleInit()).rejects.toThrow('fora');
    await s.onModuleDestroy();
    process.env.PRISMA_RETRY_MAX = '0';
    expect(await (s as any).reconnectWithBackoff(0)).toBe(false);
    delete process.env.PRISMA_RETRY_MAX;
    delete process.env.PRISMA_RETRY_DELAY_MS;
    expect(await (s as any).reconnectWithBackoff(5)).toBe(false);
  });
});
