import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { PortalClienteService } from './portal-cliente.service';

const CLIENTE = {
  id: 'c',
  ativo: true,
  razaoSocialOuNome: 'Mercado',
  nomeFantasia: 'VV',
  cnpjCpf: '123',
  telefone: '1',
  whatsapp: '2',
  email: 'm@m',
  formaPagamentoUsual: null as string | null,
  necessitaNF: true,
};

const PRODUTO = {
  id: 'a',
  nome: 'Morango',
  unidadeVenda: 'CX',
  categoria: null,
  precoSugerido: 30,
  limiteEstoqueBaixo: 5,
  estoqueMinimo: null,
  exibirQuantidadeAproximada: true,
};

const PEDIDO = {
  id: 'p',
  numero: 1,
  status: 'AGUARDANDO_APROVACAO',
  clienteId: 'c',
  totalFinal: 60,
  itens: [{ produtoId: 'a', quantidade: 2, valorUnitario: 30, produto: { nome: 'Morango' } }],
  historicoStatus: [{ status: 'NOVO', alteradoEm: 'h' }],
};

describe('PortalClienteService', () => {
  let prisma: PrismaMock;
  let pedidos: Record<string, ReturnType<typeof vi.fn>>;
  let enderecos: Record<string, ReturnType<typeof vi.fn>>;
  let clientes: Record<string, ReturnType<typeof vi.fn>>;
  let service: PortalClienteService;

  beforeEach(() => {
    prisma = criarPrismaMock();
    pedidos = { create: vi.fn(async () => ({ id: 'p' })), atualizarItensAntesAprovacao: vi.fn() };
    enderecos = { findByEntidade: vi.fn(async () => [{ id: 'e' }]) };
    clientes = { findByUsuarioId: vi.fn(async () => ({ ...CLIENTE })), update: vi.fn() };
    service = new PortalClienteService(
      prisma as any,
      pedidos as any,
      {} as any,
      enderecos as any,
      clientes as any,
    );
    prisma.pedido.findFirst.mockResolvedValue({ ...PEDIDO });
  });
  afterEach(() => {
    delete process.env.PORTAL_CLIENTE_EXIBIR_PRECO;
  });

  it('catálogo com preço do cliente, disponibilidade e quantidade aproximada', async () => {
    prisma.produto.findMany.mockResolvedValue([]);
    prisma.precoCliente.findMany.mockResolvedValue([]);
    expect(await service.catalogo('u')).toEqual([]);

    prisma.produto.findMany.mockResolvedValue([
      PRODUTO,
      {
        ...PRODUTO,
        id: 'b',
        limiteEstoqueBaixo: null,
        estoqueMinimo: 1,
        exibirQuantidadeAproximada: false,
      },
      { ...PRODUTO, id: 'z', limiteEstoqueBaixo: null },
    ]);
    prisma.movimentacaoEstoque.groupBy.mockResolvedValue([
      { produtoId: 'a', _sum: { quantidade: 3 } },
      { produtoId: 'b', _sum: {} },
    ]);
    prisma.precoCliente.findMany.mockResolvedValue([{ produtoId: 'a', precoUnitario: 25 }]);
    const [a, b, z] = await service.catalogo('u');
    expect(a).toMatchObject({
      preco: 25,
      disponibilidade: 'POUCA_QUANTIDADE',
      quantidadeAproximada: 3,
    });
    expect(b).toMatchObject({
      preco: 30,
      disponibilidade: 'INDISPONIVEL',
      quantidadeAproximada: null,
    });
    expect(z.disponibilidade).toBe('INDISPONIVEL');

    process.env.PORTAL_CLIENTE_EXIBIR_PRECO = 'false';
    prisma.movimentacaoEstoque.groupBy.mockResolvedValue(null);
    expect((await service.catalogo('u'))[0].preco).toBeNull();
  });

  it('cria pedido: cliente ativo, itens válidos e forma de pagamento', async () => {
    clientes.findByUsuarioId.mockResolvedValueOnce({ ...CLIENTE, ativo: false });
    await expect(service.criarPedido('u', { itens: [] } as any)).rejects.toThrow('Cliente inativo');
    await expect(service.criarPedido('u', { itens: [] } as any)).rejects.toThrow(
      'pelo menos um produto',
    );
    await expect(service.criarPedido('u', {} as any)).rejects.toThrow('pelo menos um produto');

    prisma.produto.findMany.mockResolvedValue([PRODUTO]);
    prisma.precoCliente.findMany.mockResolvedValue([]);
    await expect(
      service.criarPedido('u', { itens: [{ produtoId: 'x', quantidade: 1 }] } as any),
    ).rejects.toThrow('Produto indisponível');

    await service.criarPedido('u', { itens: [{ produtoId: 'a', quantidade: 2 }] } as any);
    const [dados, vendedor, opcoes] = pedidos.create.mock.calls[0];
    expect(dados).toMatchObject({
      formaPagamento: 'PIX',
      necessitaNF: true,
      itens: [{ valorUnitario: 30 }],
    });
    expect(vendedor).toBeNull();
    expect(opcoes).toEqual({ origem: 'CLIENTE', clienteId: 'c' });

    clientes.findByUsuarioId.mockResolvedValue({ ...CLIENTE, formaPagamentoUsual: 'FATURADO' });
    prisma.precoCliente.findMany.mockResolvedValue([{ produtoId: 'a', precoUnitario: 20 }]);
    await service.criarPedido('u', { itens: [{ produtoId: 'a', quantidade: 1 }] } as any);
    expect(pedidos.create.mock.calls[1][0]).toMatchObject({
      formaPagamento: 'FATURADO',
      itens: [{ valorUnitario: 20 }],
    });

    clientes.findByUsuarioId.mockResolvedValue({ ...CLIENTE, formaPagamentoUsual: 'BOLETO' });
    await service.criarPedido('u', { itens: [{ produtoId: 'a', quantidade: 1 }] } as any);
    expect(pedidos.create.mock.calls[2][0].formaPagamento).toBe('PIX');

    await service.criarPedido('u', {
      formaPagamento: 'DINHEIRO',
      itens: [{ produtoId: 'a', quantidade: 1 }],
    } as any);
    expect(pedidos.create.mock.calls[3][0].formaPagamento).toBe('DINHEIRO');
  });

  it('lista e detalha só os pedidos do cliente', async () => {
    prisma.pedido.findMany.mockResolvedValue([{ ...PEDIDO, historicoStatus: undefined }]);
    const [r] = await service.listarPedidos('u');
    expect(r).toMatchObject({ totalEstimado: 60, itens: [{ produtoId: 'a', valorUnitario: 30 }] });
    expect(r.historicoStatus).toBeUndefined();

    expect((await service.detalhe('p', 'u')).historicoStatus).toEqual([
      { status: 'NOVO', alteradoEm: 'h' },
    ]);
    prisma.pedido.findFirst.mockResolvedValueOnce(null);
    await expect(service.detalhe('p', 'u')).rejects.toThrow('Pedido não encontrado');
    prisma.pedido.findFirst.mockResolvedValueOnce({ ...PEDIDO, clienteId: 'outro' });
    await expect(service.detalhe('p', 'u')).rejects.toThrow('não tem acesso');

    process.env.PORTAL_CLIENTE_EXIBIR_PRECO = 'false';
    prisma.pedido.findFirst.mockResolvedValueOnce({
      ...PEDIDO,
      itens: [{ quantidade: 1, produto: { id: 'a' } }],
      comprovanteEntrega: { nomeRecebedor: 'Ana' },
    });
    const sem = await service.detalhe('p', 'u');
    expect(sem).toMatchObject({ totalEstimado: null, comprovante: { nomeRecebedor: 'Ana' } });
    expect(sem.itens[0]).toMatchObject({ produtoId: 'a', valorUnitario: null });
  });

  it('altera pedido só enquanto aguarda aprovação', async () => {
    const dto = { itens: [{ produtoId: 'a', quantidade: 3 }] } as any;
    prisma.pedido.findFirst.mockResolvedValueOnce(null);
    await expect(service.atualizarPedido('p', 'u', dto)).rejects.toThrow('Pedido não encontrado');
    prisma.pedido.findFirst.mockResolvedValueOnce({ ...PEDIDO, clienteId: 'x' });
    await expect(service.atualizarPedido('p', 'u', dto)).rejects.toThrow('não tem acesso');
    prisma.pedido.findFirst.mockResolvedValueOnce({ ...PEDIDO, status: 'APROVADO' });
    await expect(service.atualizarPedido('p', 'u', dto)).rejects.toThrow('aguarda aprovação');
    await expect(service.atualizarPedido('p', 'u', {} as any)).rejects.toThrow(
      'pelo menos um produto',
    );

    prisma.produto.findMany.mockResolvedValue([PRODUTO]);
    prisma.precoCliente.findMany.mockResolvedValue([{ produtoId: 'a', precoUnitario: 22 }]);
    await expect(
      service.atualizarPedido('p', 'u', { itens: [{ produtoId: 'x', quantidade: 1 }] } as any),
    ).rejects.toThrow('Produto indisponível');

    await service.atualizarPedido('p', 'u', dto);
    expect(pedidos.atualizarItensAntesAprovacao.mock.calls[0][1]).toEqual([
      { produtoId: 'a', quantidade: 3, valorUnitario: 22 },
    ]);
    expect(prisma.pedido.update).not.toHaveBeenCalled();

    prisma.precoCliente.findMany.mockResolvedValue([]);
    await service.atualizarPedido('p', 'u', { ...dto, observacoes: '  ' });
    expect(prisma.pedido.update.mock.calls[0][0].data).toEqual({ observacoes: null });
    expect(pedidos.atualizarItensAntesAprovacao.mock.calls[1][1][0].valorUnitario).toBe(30);
    await service.atualizarPedido('p', 'u', { ...dto, observacoes: ' sem gelo ' });
    expect(prisma.pedido.update.mock.calls[1][0].data).toEqual({ observacoes: 'sem gelo' });
  });

  it('avisos e conta', async () => {
    await service.notificacoes('u');
    expect(prisma.notificacaoCliente.findMany.mock.calls[0][0].where.clienteId).toBe('c');
    prisma.notificacaoCliente.updateMany.mockResolvedValue({ count: 3 });
    expect(await service.marcarNotificacoesLidas('u')).toEqual({ lidas: 3 });

    expect(await service.conta('u')).toMatchObject({ cnpjCpf: '123', enderecos: [{ id: 'e' }] });
    clientes.findByUsuarioId.mockResolvedValueOnce({ ...CLIENTE, cnpjCpf: 'SEM-DOC-1' });
    expect((await service.conta('u')).cnpjCpf).toBeNull();

    await service.atualizarConta('u', { telefone: '9' } as any);
    expect(clientes.update).toHaveBeenCalledWith('c', { telefone: '9' });
  });
});
