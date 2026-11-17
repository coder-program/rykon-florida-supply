import { BadRequestException } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataEfetiva, hojeEmBrasilia } from './data-efetiva';
import { clienteParaRevendedor, vendeSoOSeu } from './papeis';

describe('dataEfetiva', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('vazio ou hoje = agora', () => {
    expect(Math.abs(dataEfetiva(undefined, 'Data').getTime() - Date.now())).toBeLessThan(1000);
    expect(Math.abs(dataEfetiva(hojeEmBrasilia(), 'Data').getTime() - Date.now())).toBeLessThan(
      1000,
    );
  });

  it('dia anterior = meio-dia de Brasília', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
    expect(dataEfetiva('2026-11-10', 'Data').toISOString()).toBe('2026-11-10T15:00:00.000Z');
  });

  it('usa o dia de Brasília, não o UTC', () => {
    vi.useFakeTimers();
    // 01:00 UTC do dia 18 ainda é dia 17 em Brasília
    vi.setSystemTime(new Date('2026-11-18T01:00:00Z'));
    expect(hojeEmBrasilia()).toBe('2026-11-17');
    expect(() => dataEfetiva('2026-11-18', 'Data')).toThrow('não pode ser no futuro');
  });

  it('recusa formato inválido', () => {
    expect(() => dataEfetiva('17/11/2026', 'Data do pedido')).toThrow(BadRequestException);
    expect(() => dataEfetiva('17/11/2026', 'Data do pedido')).toThrow('Data do pedido inválida');
  });
});

describe('vendeSoOSeu', () => {
  it('vendedor e revendedor só veem o que é deles', () => {
    expect(vendeSoOSeu(PapelUsuario.VENDEDOR)).toBe(true);
    expect(vendeSoOSeu(PapelUsuario.REVENDEDOR)).toBe(true);
  });
  it('equipe vê tudo', () => {
    expect(vendeSoOSeu(PapelUsuario.SUPERVISOR)).toBe(false);
    expect(vendeSoOSeu(PapelUsuario.ADMINISTRATIVO)).toBe(false);
    expect(vendeSoOSeu(PapelUsuario.ADMINISTRADOR)).toBe(false);
    expect(vendeSoOSeu(undefined)).toBe(false);
  });
});

describe('clienteParaRevendedor', () => {
  const cliente = {
    id: 'c1',
    razaoSocialOuNome: 'Mercado',
    revendedorId: null as string | null,
    cnpjCpf: '123',
    telefone: '999',
    email: 'a@b.c',
    enderecos: [{ cidade: { nome: 'Curitiba' } }],
  };

  it('cliente da Flórida: revendedor vê só nome e cidade', () => {
    const visto = clienteParaRevendedor(cliente, 'rev1') as any;
    expect(visto.razaoSocialOuNome).toBe('Mercado');
    expect(visto.cidade).toBe('Curitiba');
    expect(visto.cnpjCpf).toBeUndefined();
    expect(visto.telefone).toBeUndefined();
    expect(visto.email).toBeUndefined();
    expect(visto.enderecos).toEqual([]);
  });

  it('cliente do próprio revendedor: vê tudo', () => {
    const proprio = { ...cliente, revendedorId: 'rev1' };
    expect(clienteParaRevendedor(proprio, 'rev1')).toBe(proprio);
  });
});
