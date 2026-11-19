import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { DevolucoesService } from './devolucoes.service';

const TOKEN = '123e4567-e89b-12d3-a456-426614174000';
const FOTO = 'data:image/png;base64,eA==';
const FOTOS = [FOTO, FOTO, FOTO];

const pedido = (extra: object = {}) => ({
  id: 'p',
  numero: 10,
  status: 'ENTREGUE',
  vendedorId: 'v',
  entregadorId: 'm',
  entregueEm: new Date('2026-11-10'),
  cliente: { razaoSocialOuNome: 'Mercado' },
  etiqueta: { id: 'e', tokenPublico: TOKEN },
  itens: [
    {
      id: 'i1',
      produtoId: 'a',
      quantidade: 2,
      valorUnitario: 30,
      loteId: 'l1',
      produto: { nome: 'Morango' },
    },
    {
      id: 'i2',
      produtoId: 'a',
      quantidade: 2,
      valorUnitario: 40,
      loteId: 'l2',
      produto: { nome: 'Morango' },
    },
    { id: 'i3', produtoId: 'b', quantidade: 1, valorUnitario: 50, loteId: null, produto: null },
    {
      id: 'i4',
      produtoId: 'c',
      quantidade: 0,
      valorUnitario: 1,
      loteId: null,
      produto: { nome: 'Zero' },
    },
  ],
  ...extra,
});

const itemDto = (extra: object = {}) => ({
  produtoId: 'a',
  quantidade: 1,
  motivos: ['MELADO'],
  ...extra,
});

const detalhes = (extra: object = {}) => ({
  pedidoNumero: 10,
  etiquetaToken: TOKEN,
  itens: [
    {
      produtoId: 'a',
      nome: 'Morango',
      quantidade: 3,
      valorUnitario: 35,
      valorTotal: 105,
      motivos: ['MELADO'],
    },
  ],
  status: 'APROVADA',
  quantidadeCaixas: 3,
  valorDevolucao: 105,
  ...extra,
});

describe('DevolucoesService', () => {
  let prisma: PrismaMock;
  let storage: { salvarDataUrl: ReturnType<typeof vi.fn> };
  let estoque: Record<string, ReturnType<typeof vi.fn>>;
  let service: DevolucoesService;

  beforeEach(() => {
    prisma = criarPrismaMock();
    storage = { salvarDataUrl: vi.fn(async () => '/uploads/f.jpg') };
    estoque = { baixarLoteEmTx: vi.fn(), retirarDoPedidoEmTx: vi.fn() };
    service = new DevolucoesService(prisma as any, storage as any, estoque as any);
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    prisma.pedido.findMany.mockResolvedValue([pedido()]);
    prisma.usuario.findUnique.mockResolvedValue({ nome: 'Duda' });
    prisma.logAuditoria.create.mockImplementation(async ({ data }: any) => ({
      id: 'log',
      entidadeId: data.entidadeId,
      detalhes: data.detalhes,
      data: new Date(),
      usuario: { nome: 'Zé' },
    }));
  });

  it('lista pedidos entregues conforme o perfil; revendedor sem etiqueta', async () => {
    await expect(service.listarPedidosParaDevolucao('u', 'CLIENTE' as any)).rejects.toThrow(
      'não pode registrar devolução',
    );
    const [motorista] = await service.listarPedidosParaDevolucao('m', 'MOTORISTA');
    expect(prisma.pedido.findMany.mock.calls[0][0].where).toEqual({
      entregadorId: 'm',
      status: 'ENTREGUE',
    });
    // Produto em dois lotes vira uma linha; quantidade zero some
    expect(motorista.itens).toEqual([
      { produtoId: 'a', nome: 'Morango', quantidade: 4 },
      { produtoId: 'b', nome: 'b', quantidade: 1 },
    ]);
    expect(motorista.etiquetaToken).toBe(TOKEN);

    await service.listarPedidosParaDevolucao('s', 'SUPERVISOR');
    expect(prisma.pedido.findMany.mock.calls[1][0].where).toEqual({ status: 'ENTREGUE' });
    prisma.pedido.findMany.mockResolvedValue([pedido({ cliente: null, etiqueta: null })]);
    const [rev] = await service.listarPedidosParaDevolucao('r', 'REVENDEDOR');
    expect(prisma.pedido.findMany.mock.calls[2][0].where).toEqual({
      vendedorId: 'r',
      status: 'ENTREGUE',
    });
    expect(rev).toMatchObject({ etiquetaId: null, etiquetaToken: null, cliente: null });
  });

  it('criar: fotos e acesso ao pedido', async () => {
    const dto = (extra: object = {}) =>
      ({ pedidoId: 'p', fotos: FOTOS, itens: [itemDto()], ...extra }) as any;
    await expect(service.criar(dto({ fotos: [FOTO] }), 'v', 'VENDEDOR')).rejects.toThrow(
      'exatamente 3 fotos',
    );
    await expect(service.criar(dto({ fotos: undefined }), 'v', 'VENDEDOR')).rejects.toThrow(
      '3 fotos',
    );

    prisma.pedido.findUnique.mockResolvedValueOnce(null);
    await expect(service.criar(dto(), 'v', 'VENDEDOR')).rejects.toThrow('Pedido não encontrado');
    await expect(service.criar(dto(), 'outro', 'VENDEDOR')).rejects.toThrow('dos seus pedidos');
    await expect(service.criar(dto(), 'outro', 'MOTORISTA')).rejects.toThrow('dos seus pedidos');
    prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'EM_ENTREGA' }));
    await expect(service.criar(dto(), 'v', 'VENDEDOR')).rejects.toThrow('pedido entregue');

    await expect(service.criar(dto({ pedidoId: ' ' }), 'v', 'VENDEDOR')).rejects.toThrow(
      'Selecione o pedido',
    );
    await expect(
      service.criar(dto({ pedidoId: undefined, etiquetaToken: TOKEN }), 'v', 'VENDEDOR'),
    ).rejects.toThrow('Etiqueta não encontrada');
    await expect(
      service.criar(dto({ fotos: [FOTO, FOTO, 'http://x'] }), 'v', 'VENDEDOR'),
    ).rejects.toThrow('fotos é inválida');
  });

  it('criar: valida itens e motivos', async () => {
    const criar = (itens: unknown) =>
      service.criar({ pedidoId: 'p', itens } as any, 'adm', 'ADMINISTRADOR');
    await expect(criar([])).rejects.toThrow('ao menos um item');
    await expect(criar(undefined)).rejects.toThrow('ao menos um item');
    await expect(criar([itemDto({ produtoId: 'x' })])).rejects.toThrow('não pertence ao pedido');
    await expect(criar([itemDto({ quantidade: 0 })])).rejects.toThrow(
      'Quantidade devolvida inválida',
    );
    await expect(criar([itemDto({ quantidade: undefined })])).rejects.toThrow('inválida');
    await expect(criar([itemDto({ quantidade: 5 })])).rejects.toThrow(
      'acima do pedido para Morango',
    );
    await expect(criar([itemDto({ motivos: [] })])).rejects.toThrow('Informe o motivo');
    await expect(criar([itemDto({ motivos: undefined })])).rejects.toThrow('Informe o motivo');
    await expect(criar([itemDto({ motivos: ['OUTROS'], motivoOutro: ' ' })])).rejects.toThrow(
      'Escreva o motivo "Outros"',
    );
  });

  it('criar pelo escritório: sem foto, já aprovada, preço médio dos lotes', async () => {
    const r: any = await service.criar(
      {
        pedidoId: 'p',
        observacao: ' amassado ',
        itens: [
          itemDto({
            quantidade: 2,
            motivos: ['MELADO', 'MELADO', 'OUTROS'],
            motivoOutro: ' sujo ',
          }),
          itemDto({ produtoId: 'b', motivos: ['REFUGO'], motivoOutro: 'ignorado' }),
        ],
      } as any,
      'adm',
      'ADMINISTRADOR',
    );
    expect(storage.salvarDataUrl).not.toHaveBeenCalled();
    const d = prisma.logAuditoria.create.mock.calls[0][0].data.detalhes;
    expect(d).toMatchObject({
      status: 'APROVADA',
      analisadoPor: 'Duda',
      observacao: 'amassado',
      quantidadeCaixas: 3,
      valorDevolucao: 120,
      itensDevolvidos: '2x Morango (Melado, sujo), 1x b (Refugo)',
    });
    expect(d.itens[0]).toMatchObject({
      valorUnitario: 35,
      motivos: ['MELADO', 'OUTROS'],
      motivoOutro: 'sujo',
    });
    expect(d.itens[1].motivoOutro).toBeUndefined();
    expect(r.itens[0].motivosTexto).toBe('Melado, sujo');
    expect(r).toMatchObject({ pedidoNumero: 10, status: 'APROVADA', registradoPor: 'Zé' });
  });

  it('criar pelo vendedor via QR: fica pendente; revendedor não vê a etiqueta', async () => {
    prisma.etiqueta.findUnique.mockResolvedValue({
      pedido: pedido({ vendedorId: 'r', etiqueta: null }),
    });
    prisma.usuario.findUnique.mockResolvedValue(null);
    const r: any = await service.criar(
      {
        etiquetaToken: `https://x/p/${TOKEN}`,
        fotos: FOTOS,
        itens: [itemDto()],
        quantidadeCaixas: 9,
      } as any,
      'r',
      'REVENDEDOR',
    );
    expect(prisma.etiqueta.findUnique.mock.calls[0][0].where.tokenPublico).toBe(TOKEN);
    expect(storage.salvarDataUrl).toHaveBeenCalledTimes(3);
    const d = prisma.logAuditoria.create.mock.calls[0][0].data.detalhes;
    expect(d).toMatchObject({ status: 'PENDENTE', quantidadeCaixas: 9, etiquetaToken: '' });
    expect(d.analisadoPor).toBeUndefined();
    expect(r).toMatchObject({ etiquetaId: null, etiquetaToken: null });

    prisma.etiqueta.findUnique.mockResolvedValue({ pedido: pedido() });
    await service.criar(
      { etiquetaToken: 'abc', fotos: FOTOS, itens: [itemDto()] } as any,
      'v',
      'VENDEDOR',
    );
    expect(prisma.etiqueta.findUnique.mock.calls[1][0].where.tokenPublico).toBe('abc');
  });

  it('buscar pedido pela etiqueta', async () => {
    prisma.etiqueta.findUnique.mockResolvedValue({ pedido: pedido() });
    expect((await service.buscarPedidoPorEtiqueta(TOKEN, 's', 'SUPERVISOR')).pedidoNumero).toBe(10);
    await expect(
      service.buscarPedidoPorEtiqueta(undefined as any, 's', 'SUPERVISOR'),
    ).rejects.toThrow('Selecione o pedido');
  });

  it('listas: minhas e todas, com dados antigos ou incompletos', async () => {
    prisma.logAuditoria.findMany.mockResolvedValue([
      {
        id: '1',
        entidadeId: 'p',
        data: 'd',
        usuario: { nome: 'Zé' },
        detalhes: detalhes({
          status: 'CONCLUIDA',
          fotos: ['f'],
          itens: [{ produtoId: 'a', quantidade: 1 }, { produtoId: '', quantidade: 1 }, null],
          reembolso: { tipo: 'DINHEIRO' },
        }),
      },
      {
        id: '2',
        entidadeId: 'outro',
        data: 'd',
        usuario: null,
        detalhes: {
          status: 'X',
          pedidoNumero: 'abc',
          quantidadeCaixas: '3',
          etiquetaId: 'e9',
          pedidoId: 'p',
          observacao: 'o',
          itensDevolvidos: 'txt',
          resposta: 'r',
          analisadoPor: 'a',
          analisadoEm: 't',
          criadoEm: 'c',
          reembolso: 'x',
        },
      },
      { id: '3', entidadeId: null, data: 'd', detalhes: null },
    ]);
    prisma.pedido.findMany.mockResolvedValue([pedido({ vendedor: { nome: 'Cesar' } })]);
    const todas = await service.listarTodas();
    expect(todas[0]).toMatchObject({
      status: 'CONCLUIDA',
      vendedor: 'Cesar',
      fotos: ['f'],
      reembolso: { tipo: 'DINHEIRO' },
    });
    expect(todas[0].itens).toEqual([
      {
        produtoId: 'a',
        nome: '',
        quantidade: 1,
        valorUnitario: 0,
        valorTotal: 0,
        motivos: [],
        motivoOutro: undefined,
        motivosTexto: null,
      },
    ]);
    expect(todas[1]).toMatchObject({
      status: 'PENDENTE',
      pedidoNumero: null,
      etiquetaId: 'e9',
      etiquetaToken: null,
      quantidadeCaixas: null,
      registradoPor: null,
      reembolso: null,
      resposta: 'r',
    });
    expect(todas[2]).toMatchObject({ itens: [], fotos: [] });

    const minhas = await service.listarMinhas('r', 'REVENDEDOR');
    expect(prisma.logAuditoria.findMany.mock.calls[1][0].where.usuarioId).toBe('r');
    expect(minhas[0].etiquetaToken).toBeNull();

    prisma.logAuditoria.findMany.mockResolvedValue([]);
    expect(await service.listarMinhas('v', 'VENDEDOR')).toEqual([]);
  });

  it('aprovar ou negar só uma vez', async () => {
    await expect(service.atualizarStatus('x', { status: 'APROVADA' } as any, 'u')).rejects.toThrow(
      'Devolução não encontrada',
    );
    prisma.logAuditoria.findUnique.mockResolvedValue({ acao: 'OUTRA' });
    await expect(service.atualizarStatus('x', { status: 'APROVADA' } as any, 'u')).rejects.toThrow(
      'não encontrada',
    );
    prisma.logAuditoria.findUnique.mockResolvedValue({
      acao: 'REGISTRAR_DEVOLUCAO',
      detalhes: detalhes(),
    });
    await expect(service.atualizarStatus('x', { status: 'NEGADA' } as any, 'u')).rejects.toThrow(
      'já foi analisada',
    );

    prisma.logAuditoria.findUnique.mockResolvedValue({
      acao: 'REGISTRAR_DEVOLUCAO',
      entidadeId: 'p',
      detalhes: detalhes({ status: 'PENDENTE' }),
    });
    prisma.logAuditoria.update.mockImplementation(async ({ data }: any) => ({
      id: 'x',
      entidadeId: 'p',
      detalhes: data.detalhes,
    }));
    const r: any = await service.atualizarStatus(
      'x',
      { status: 'NEGADA', resposta: ' não procede ' } as any,
      'u',
    );
    expect(r).toMatchObject({ status: 'NEGADA', resposta: 'não procede', analisadoPor: 'Duda' });
    await service.atualizarStatus('x', { status: 'APROVADA' } as any, 'u');
    expect(prisma.logAuditoria.create.mock.calls[1][0].data.detalhes.resposta).toBeNull();
  });

  describe('reembolso', () => {
    beforeEach(() => {
      prisma.logAuditoria.findUnique.mockResolvedValue({
        id: 'x',
        acao: 'REGISTRAR_DEVOLUCAO',
        entidadeId: 'p',
        detalhes: detalhes(),
      });
      prisma.logAuditoria.findUniqueOrThrow.mockResolvedValue({
        id: 'x',
        entidadeId: 'p',
        detalhes: detalhes({ status: 'CONCLUIDA' }),
      });
      prisma.loteProduto.findUnique.mockImplementation(
        async ({ where }: any) =>
          ({
            lp: { id: 'lp', numero: '77', produtoId: 'a', valorUnitario: 20 },
            lx: { id: 'lx', produtoId: 'z' },
          })[where.id] ?? null,
      );
      prisma.movimentacaoEstoque.create.mockResolvedValue({ id: 'mov' });
      prisma.pedido.findUniqueOrThrow.mockResolvedValue({ valorFrete: 10, descontoValor: null });
      prisma.itemPedido.findMany.mockResolvedValue([{ valorTotal: 50 }, { valorTotal: 20 }]);
    });
    const base = { perdaLoteId: 'lp', perdaQuantidade: 3 };

    it('só de devolução aprovada e lote da perda do mesmo produto', async () => {
      prisma.logAuditoria.findUnique.mockResolvedValueOnce(null);
      await expect(service.registrarReembolso('x', base as any, 'u')).rejects.toThrow(
        'não encontrada',
      );
      prisma.logAuditoria.findUnique.mockResolvedValueOnce({
        acao: 'REGISTRAR_DEVOLUCAO',
        detalhes: detalhes({ status: 'PENDENTE' }),
      });
      await expect(service.registrarReembolso('x', base as any, 'u')).rejects.toThrow(
        'devolução aprovada',
      );
      await expect(
        service.registrarReembolso(
          'x',
          { ...base, perdaLoteId: 'lx', tipo: 'DINHEIRO' } as any,
          'u',
        ),
      ).rejects.toThrow('lote da perda');
      await expect(
        service.registrarReembolso(
          'x',
          { ...base, perdaLoteId: 'nada', tipo: 'DINHEIRO' } as any,
          'u',
        ),
      ).rejects.toThrow('lote da perda');
    });

    it('em dinheiro: reduz o pedido pelas linhas do produto e registra a perda', async () => {
      await expect(
        service.registrarReembolso('x', { ...base, tipo: 'DINHEIRO', valor: 50 } as any, 'u'),
      ).rejects.toThrow('valor e a forma de pagamento');

      prisma.pedido.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.registrarReembolso(
          'x',
          { ...base, tipo: 'DINHEIRO', valor: 50, formaPagamento: 'PIX' } as any,
          'u',
        ),
      ).rejects.toThrow('Pedido da devolução não encontrado');

      prisma.pedido.findUnique.mockResolvedValue({
        itens: [
          { id: 'i1', produtoId: 'a', quantidade: 2, valorUnitario: 30, loteId: 'l1' },
          { id: 'i0', produtoId: 'a', quantidade: 0, valorUnitario: 30, loteId: 'l0' },
          { id: 'i2', produtoId: 'a', quantidade: 2, valorUnitario: 40, loteId: 'l2' },
        ],
      });
      // Linha com quantidade zero no meio é pulada; a devolução sai das últimas linhas primeiro
      await service.registrarReembolso(
        'x',
        {
          ...base,
          tipo: 'DINHEIRO',
          valor: 105,
          formaPagamento: 'PIX',
          perdaValor: 60,
          data: undefined,
        } as any,
        'u',
      );
      expect(
        prisma.itemPedido.update.mock.calls.map((c: any) => [c[0].where.id, c[0].data.quantidade]),
      ).toEqual([
        ['i2', 0],
        ['i1', 1],
      ]);
      expect(estoque.retirarDoPedidoEmTx).toHaveBeenCalledTimes(2);
      expect(prisma.pedido.update.mock.calls[0][0].data).toEqual({ subtotal: 70, totalFinal: 80 });
      expect(prisma.perdaDevolucao.create.mock.calls[0][0].data).toMatchObject({
        valor: 60,
        quantidade: 3,
        loteId: 'lp',
      });
      const concluida = prisma.logAuditoria.update.mock.calls[0][0].data.detalhes;
      expect(concluida).toMatchObject({
        status: 'CONCLUIDA',
        reembolso: { tipo: 'DINHEIRO', valor: 105, perda: { lote: '77' } },
      });

      await service.registrarReembolso(
        'x',
        { ...base, tipo: 'DINHEIRO', valor: 1, formaPagamento: 'PIX' } as any,
        'u',
      );
      expect(prisma.perdaDevolucao.create.mock.calls[1][0].data.valor).toBe(0);
    });

    it('em dinheiro: devolução sem itens ou acima do pedido', async () => {
      prisma.logAuditoria.findUnique.mockResolvedValueOnce({
        acao: 'REGISTRAR_DEVOLUCAO',
        detalhes: detalhes({ itens: [] }),
      });
      await expect(
        service.registrarReembolso(
          'x',
          { ...base, tipo: 'DINHEIRO', valor: 1, formaPagamento: 'PIX' } as any,
          'u',
        ),
      ).rejects.toThrow('lote da perda');

      prisma.pedido.findUnique.mockResolvedValue({
        itens: [{ id: 'i1', produtoId: 'a', quantidade: 1, valorUnitario: 30 }],
      });
      await expect(
        service.registrarReembolso(
          'x',
          { ...base, tipo: 'DINHEIRO', valor: 1, formaPagamento: 'PIX' } as any,
          'u',
        ),
      ).rejects.toThrow('excede o saldo atual');
    });

    it('aplicar no pedido exige itens', async () => {
      await expect(
        (service as any).aplicarDevolucaoNoPedido(prisma, 'p', { itens: [] }),
      ).rejects.toThrow('Não há itens devolvidos');
      prisma.pedido.findUnique.mockResolvedValue({ itens: [] });
      await (service as any).aplicarDevolucaoNoPedido(prisma, 'p', {
        itens: [{ produtoId: 'a', quantidade: 0 }],
      });
      expect(prisma.itemPedido.update).not.toHaveBeenCalled();
    });

    it('em caixas: repõe do lote escolhido e o custo vira perda', async () => {
      await expect(
        service.registrarReembolso('x', { ...base, tipo: 'CAIXAS' } as any, 'u'),
      ).rejects.toThrow('quantidade e o lote');
      await expect(
        service.registrarReembolso(
          'x',
          { ...base, tipo: 'CAIXAS', quantidadeCaixas: 2, loteId: 'lx' } as any,
          'u',
        ),
      ).rejects.toThrow('lote precisa ser de um produto');
      await expect(
        service.registrarReembolso(
          'x',
          { ...base, tipo: 'CAIXAS', quantidadeCaixas: 2, loteId: 'nada' } as any,
          'u',
        ),
      ).rejects.toThrow('lote precisa ser de um produto');

      await service.registrarReembolso(
        'x',
        { ...base, tipo: 'CAIXAS', quantidadeCaixas: 2, loteId: 'lp', data: '2026-11-01' } as any,
        'u',
      );
      expect(prisma.movimentacaoEstoque.create.mock.calls[0][0].data).toMatchObject({
        quantidade: -2,
        origem: 'Reembolso em caixas do pedido 10',
      });
      expect(estoque.baixarLoteEmTx.mock.calls[0][1]).toMatchObject({
        loteId: 'lp',
        quantidade: 2,
        movimentacaoId: 'mov',
      });
      expect(prisma.perdaDevolucao.create.mock.calls[0][0].data.valor).toBe(40);
      expect(prisma.pedido.update).not.toHaveBeenCalled();

      prisma.logAuditoria.findUnique.mockResolvedValue({
        acao: 'REGISTRAR_DEVOLUCAO',
        entidadeId: 'p',
        detalhes: detalhes({ pedidoNumero: undefined }),
      });
      await service.registrarReembolso(
        'x',
        { ...base, tipo: 'CAIXAS', quantidadeCaixas: 1, loteId: 'lp' } as any,
        'u',
      );
      expect(prisma.movimentacaoEstoque.create.mock.calls[1][0].data.origem).toBe(
        'Reembolso em caixas do pedido',
      );
    });
  });

  it('perdas do período', async () => {
    await expect(service.perdas('x')).rejects.toThrow('Período inválido');
    await expect(service.perdas(undefined, 'x')).rejects.toThrow('Período inválido');
    prisma.perdaDevolucao.findMany.mockResolvedValue([
      {
        id: '1',
        data: 'd',
        quantidade: '2',
        valor: '40',
        pedido: { numero: 1, cliente: { razaoSocialOuNome: 'M' } },
        lote: { numero: '77', produto: { nome: 'Morango' } },
      },
      {
        id: '2',
        data: 'd',
        quantidade: 1,
        valor: 10,
        pedido: { numero: 2, cliente: null },
        lote: { numero: '78', produto: { nome: 'Uva' } },
      },
    ]);
    const r = await service.perdas('2026-11-01', '2026-11-30');
    expect(r).toMatchObject({ totalCaixas: 3, valorTotal: 50 });
    expect(r.itens[1].cliente).toBeNull();
    await service.perdas();
  });

  it('resumo por status', async () => {
    prisma.logAuditoria.findMany.mockResolvedValue([
      { detalhes: detalhes({ status: 'CONCLUIDA' }) },
      { detalhes: detalhes({ status: 'APROVADA' }) },
      { detalhes: detalhes({ status: 'NEGADA', quantidadeCaixas: 0, valorDevolucao: 0 }) },
      { detalhes: { status: 'PENDENTE' } },
    ]);
    expect(await service.resumo()).toEqual({
      total: 4,
      pendentes: 1,
      aprovadas: 1,
      concluidas: 1,
      negadas: 1,
      totalCaixas: 6,
      valorTotal: 210,
    });
    await service.resumo({ dataInicio: '2026-11-01', dataFim: '2026-11-30' });
    const where = prisma.logAuditoria.findMany.mock.calls[1][0].where;
    expect(where.data.gte.getDate()).toBe(1);
    expect(where.data.lte.getHours()).toBe(23);
    await service.resumo({ dataInicio: '2026' });
    expect(prisma.logAuditoria.findMany.mock.calls[2][0].where.data.gte.getMonth()).toBe(0);
    await service.resumo({ dataFim: '2026' });
    expect(prisma.logAuditoria.findMany.mock.calls[3][0].where.data.gte).toBeUndefined();
  });
});
