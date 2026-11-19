import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { GeocodificacaoService } from './geocodificacao.service';
import { hojeBrasilia, montarAvisoCobranca } from '../financeiro/avisos-cobranca.util';

const endereco = (extra: object = {}) => ({
  id: 'e1',
  logradouro: 'Rua A',
  numero: '10',
  bairro: 'Centro',
  cep: '01000-000',
  latitude: null,
  longitude: null,
  geocodificadoEm: null,
  cidade: { nome: 'São Paulo', estado: { sigla: 'SP' } },
  ...extra,
});

const resposta = (corpo: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => corpo,
});

describe('GeocodificacaoService', () => {
  let prisma: PrismaMock;
  let fetch: ReturnType<typeof vi.fn>;
  let service: GeocodificacaoService;
  const config: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    prisma = criarPrismaMock();
    fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    service = new GeocodificacaoService(prisma as any, { get: (k: string) => config[k] } as any);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    for (const k of Object.keys(config)) delete config[k];
  });

  it('só tenta endereço sem ponto, e de novo depois de 7 dias', async () => {
    service.agendar([
      endereco({ id: 'tem', latitude: 1, longitude: 2 }),
      endereco({ id: 'recente', geocodificadoEm: new Date() }),
    ]);
    await vi.runAllTimersAsync();
    expect(fetch).not.toHaveBeenCalled();

    fetch.mockResolvedValue(resposta([{ lat: '-23.5', lon: '-46.6' }]));
    service.agendar([endereco({ id: 'velho', geocodificadoEm: new Date(0) })]);
    await vi.runAllTimersAsync();
    expect(prisma.endereco.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'velho' },
      data: { latitude: -23.5, longitude: -46.6 },
    });
  });

  it('não repete endereço em andamento e respeita o limite', async () => {
    fetch.mockResolvedValue(resposta([{ lat: '1', lon: '2' }]));
    service.agendar([endereco({ id: 'a' }), endereco({ id: 'b' })], 1);
    service.agendar([endereco({ id: 'a' })]);
    await vi.runAllTimersAsync();
    expect(prisma.endereco.update).toHaveBeenCalledTimes(1);
  });

  it('tenta só rua + cidade quando o completo não acha; sem ponto grava null', async () => {
    fetch
      .mockResolvedValueOnce(resposta([]))
      .mockResolvedValueOnce(resposta([{ lat: '1', lon: '2' }]));
    service.agendar([endereco()]);
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(fetch.mock.calls[1][0])).toContain('q=Rua A, São Paulo, SP');

    fetch.mockReset();
    fetch
      .mockResolvedValueOnce(resposta(null, false, 429))
      .mockResolvedValueOnce(resposta([{ lat: 'x', lon: '2' }]));
    service.agendar([endereco({ id: 'e2', cidade: null })]);
    await vi.runAllTimersAsync();
    expect(prisma.endereco.update.mock.calls[1][0].data).toMatchObject({
      latitude: null,
      longitude: null,
    });
  });

  it('falha de rede ou de gravação não quebra', async () => {
    config.GEOCODER_URL = 'http://geo';
    config.GEOCODER_USER_AGENT = 'teste';
    fetch.mockRejectedValue(new Error('offline'));
    prisma.endereco.update.mockRejectedValue(new Error('banco'));
    service.agendar([endereco({ cidade: { nome: 'X', estado: null } })]);
    await vi.runAllTimersAsync();
    expect(fetch.mock.calls[0][0]).toMatch(/^http:\/\/geo\?/);
    expect(fetch.mock.calls[0][1].headers['User-Agent']).toBe('teste');
  });
});

describe('avisos de cobrança', () => {
  it('monta título e mensagem', () => {
    const dados = { cliente: 'Mercado', dataCompra: new Date('2026-11-07T15:00:00Z'), valor: 108 };
    const aviso = montarAvisoCobranca('VENCE_EM_3_DIAS', dados);
    expect(aviso.titulo).toBe('Pagamento vence em 3 dias');
    expect(aviso.mensagem).toContain('compra do dia 07/11/2026');
    expect(aviso.mensagem).toMatch(/R\$\s108,00/);
    expect(montarAvisoCobranca('VENCIMENTO_HOJE', { ...dados, vencido: true }).titulo).toBe(
      'Pagamento vencido',
    );
  });

  it('hoje em Brasília à meia-noite UTC', () => {
    expect(hojeBrasilia().toISOString()).toMatch(/T00:00:00\.000Z$/);
  });
});
