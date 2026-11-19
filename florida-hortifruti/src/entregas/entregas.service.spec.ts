import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { EntregasService } from './entregas.service';

const end = (entidadeId: string, extra: object = {}) => ({
  entidadeId,
  tipo: 'PRINCIPAL',
  principal: false,
  logradouro: 'Rua A',
  numero: '1',
  bairro: 'Centro',
  cidade: { nome: 'SP', estado: { sigla: 'SP' } },
  latitude: -23,
  longitude: -46,
  ...extra,
});

const pedidoPainel = (extra: object = {}) => ({
  id: 'p',
  numero: 1,
  status: 'APROVADO',
  clienteId: 'c1',
  cliente: { razaoSocialOuNome: 'Mercado', nomeFantasia: null },
  entregador: null,
  dataPrevistaEntrega: null,
  entregueEm: null,
  problemaEntrega: null,
  problemaEntregaEm: null,
  ...extra,
});

const pedidoRota = (id: string, extra: object = {}) => ({
  id,
  numero: Number(id.replace(/\D/g, '')) || 1,
  status: 'PRONTO_PARA_ENTREGA',
  clienteId: 'c1',
  cliente: { razaoSocialOuNome: 'Mercado', nomeFantasia: 'VV' },
  entregador: { id: 'm1', nome: 'Zé', papel: 'MOTORISTA' },
  historicoStatus: [],
  data: new Date('2026-11-01T10:00:00Z'),
  ordemRota: null,
  entregueEm: null,
  ...extra,
});

describe('EntregasService', () => {
  let prisma: PrismaMock;
  let geo: { agendar: ReturnType<typeof vi.fn> };
  let service: EntregasService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    geo = { agendar: vi.fn() };
    service = new EntregasService(prisma as any, geo as any);
    prisma.endereco.findMany.mockResolvedValue([]);
    prisma.localizacaoMotorista.findMany.mockResolvedValue([]);
  });

  it('painel: período inválido', async () => {
    await expect(service.painel('ontem')).rejects.toThrow('Período inválido');
    await expect(service.painel(undefined, 'x')).rejects.toThrow('Período inválido');
  });

  it('painel: situação e endereço de cada pedido', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      pedidoPainel({ status: 'ENTREGUE' }),
      pedidoPainel({ problemaEntrega: 'portão fechado', clienteId: 'c2' }),
      pedidoPainel({ status: 'EM_ENTREGA', clienteId: 'c3', entregador: { nome: 'Zé' } }),
      pedidoPainel({ clienteId: 'c4', cliente: { razaoSocialOuNome: 'R', nomeFantasia: 'F' } }),
      pedidoPainel({ clienteId: 'c5' }),
    ]);
    prisma.endereco.findMany.mockResolvedValue([
      end('c1', { principal: true }),
      end('c1', { tipo: 'ENTREGA', logradouro: 'Rua Entrega' }),
      end('c2', { principal: true, cidade: { nome: 'Osasco', estado: null } }),
      end('c3', { cidade: null, numero: null }),
      end('c4', { cidade: { nome: '', estado: { sigla: 'SP' } } }),
    ]);
    const r = await service.painel('2026-11-01', '2026-11-02');
    expect(r.map((p) => p.situacao)).toEqual([
      'ENTREGUE',
      'PROBLEMA',
      'EM_ROTA',
      'PENDENTE',
      'PENDENTE',
    ]);
    expect(r[0].endereco).toBe('Rua Entrega, 1, Centro, SP/SP');
    expect(r[1].endereco).toBe('Rua A, 1, Centro, Osasco');
    expect(r[2]).toMatchObject({ endereco: 'Rua A, Centro', responsavel: 'Zé' });
    expect(r[3]).toMatchObject({ cliente: 'F', endereco: 'Rua A, 1, Centro' });
    expect(r[4].endereco).toBe('');

    prisma.pedido.findMany.mockResolvedValue([]);
    expect(await service.painel()).toEqual([]);
  });

  it('data prevista, problema e resolução só em entrega aberta', async () => {
    await expect(service.definirDataPrevista('p')).rejects.toThrow('Pedido não encontrado');
    prisma.pedido.findUnique.mockResolvedValue({ id: 'p', status: 'ENTREGUE' });
    await expect(service.resolverProblema('p', 'u')).rejects.toThrow('já foi encerrada');

    prisma.pedido.findUnique.mockResolvedValue({ id: 'p', status: 'EM_ENTREGA' });
    await service.definirDataPrevista('p', '2026-11-20');
    await service.definirDataPrevista('p');
    expect(prisma.pedido.update.mock.calls.map((c: any) => c[0].data.dataPrevistaEntrega)).toEqual([
      new Date('2026-11-20'),
      null,
    ]);

    await expect(service.registrarProblema('p', '  ', 'u')).rejects.toThrow('Descreva o problema');
    expect(await service.registrarProblema('p', ' sem acesso ', 'u')).toEqual({ ok: true });
    expect(prisma.pedido.update.mock.calls[2][0].data.problemaEntrega).toBe('sem acesso');
    expect(await service.resolverProblema('p', 'u')).toEqual({ ok: true });
    expect(prisma.logAuditoria.create.mock.calls.map((c: any) => c[0].data.acao)).toEqual([
      'PROBLEMA_ENTREGA',
      'PROBLEMA_ENTREGA_RESOLVIDO',
    ]);
  });

  it('acompanhamento: agrupa por motorista e ordena a rota', async () => {
    const agora = Date.now();
    prisma.pedido.findMany.mockResolvedValue([
      pedidoRota('p1', { ordemRota: 2 }),
      pedidoRota('p2', { ordemRota: 1 }),
      pedidoRota('p3', { historicoStatus: [{ alteradoEm: new Date('2026-11-01T09:00:00Z') }] }),
      pedidoRota('p4'),
      pedidoRota('p5', { status: 'EM_ENTREGA' }),
      pedidoRota('p6', { status: 'ENTREGUE', entregueEm: new Date(agora - 1000) }),
      pedidoRota('p7', { status: 'ENTREGUE', entregueEm: new Date(agora) }),
      pedidoRota('p8', { status: 'ENTREGUE', entregueEm: null }),
      pedidoRota('p9', {
        clienteId: 'c9',
        entregador: { id: 'm2', nome: 'Ana', papel: 'SUPERVISOR' },
      }),
    ]);
    prisma.endereco.findMany.mockResolvedValue([end('c1', { principal: true })]);
    prisma.localizacaoMotorista.findMany.mockResolvedValue([
      {
        usuarioId: 'm1',
        latitude: 1,
        longitude: 2,
        precisao: 5,
        atualizadoEm: new Date(agora),
        usuario: { nome: 'Zé', ativo: true, papel: 'MOTORISTA' },
      },
      // Sem pedido, mas com posição recente: aparece
      {
        usuarioId: 'm3',
        latitude: 1,
        longitude: 2,
        precisao: null,
        atualizadoEm: new Date(agora),
        usuario: { nome: 'Bia', ativo: true, papel: 'SUPERVISOR' },
      },
      // Posição velha, inativo ou que não faz entrega: fica de fora
      {
        usuarioId: 'm4',
        atualizadoEm: new Date(0),
        usuario: { nome: 'Velho', ativo: true, papel: 'MOTORISTA' },
      },
      {
        usuarioId: 'm5',
        atualizadoEm: new Date(agora),
        usuario: { nome: 'Inativo', ativo: false, papel: 'MOTORISTA' },
      },
      {
        usuarioId: 'm6',
        atualizadoEm: new Date(agora),
        usuario: { nome: 'Vendedor', ativo: true, papel: 'VENDEDOR' },
      },
    ]);

    const r = await service.acompanhamento();
    expect(geo.agendar).toHaveBeenCalledWith([expect.objectContaining({ entidadeId: 'c1' })]);
    expect(r.map((m) => m.motorista.nome)).toEqual(['Zé', 'Ana', 'Bia']);

    const ze = r[0];
    expect(ze.emEntrega?.id).toBe('p5');
    expect(ze.proximos.map((p) => p.id)).toEqual(['p2', 'p1', 'p3', 'p4']);
    expect(ze.entregues.map((p) => p.id)).toEqual(['p7', 'p6', 'p8']);
    expect(ze).toMatchObject({ total: 8, concluidas: 3, localizacao: { precisao: 5 } });
    expect(ze.proximos[0]).toMatchObject({ cliente: 'VV', latitude: -23 });

    expect(r[1]).toMatchObject({ localizacao: null, emEntrega: null });
    expect(r[1].proximos[0]).toMatchObject({ latitude: null, endereco: '' });
    expect(r[2]).toMatchObject({ total: 0, proximos: [] });
  });

  it('acompanhamento: ordena por pendentes e depois pelo nome', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      pedidoRota('p1', { entregador: { id: 'b', nome: 'Bruno' } }),
      pedidoRota('p2', { entregador: { id: 'a', nome: 'André' } }),
    ]);
    const r = await service.acompanhamento();
    expect(r.map((m) => m.motorista.nome)).toEqual(['André', 'Bruno']);
  });

  it('define a ordem da rota de um único entregador', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([
      { id: 'a', entregadorId: 'm', status: 'APROVADO' },
    ]);
    await expect(service.definirOrdem(['a', 'b'])).rejects.toThrow('Pedido não encontrado');

    prisma.pedido.findMany.mockResolvedValueOnce([
      { id: 'a', entregadorId: 'm', status: 'APROVADO' },
      { id: 'b', entregadorId: 'n', status: 'APROVADO' },
    ]);
    await expect(service.definirOrdem(['a', 'b'])).rejects.toThrow('único entregador');
    prisma.pedido.findMany.mockResolvedValueOnce([
      { id: 'a', entregadorId: null, status: 'APROVADO' },
    ]);
    await expect(service.definirOrdem(['a'])).rejects.toThrow('único entregador');
    prisma.pedido.findMany.mockResolvedValueOnce([
      { id: 'a', entregadorId: 'm', status: 'ENTREGUE' },
    ]);
    await expect(service.definirOrdem(['a'])).rejects.toThrow('ainda não entregues');

    prisma.pedido.findMany.mockResolvedValueOnce([
      { id: 'a', entregadorId: 'm', status: 'APROVADO' },
      { id: 'b', entregadorId: 'm', status: 'EM_ENTREGA' },
    ]);
    expect(await service.definirOrdem(['b', 'a', 'b'])).toEqual({ ok: true });
    expect(
      prisma.pedido.update.mock.calls.map((c: any) => [c[0].where.id, c[0].data.ordemRota]),
    ).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });
});
