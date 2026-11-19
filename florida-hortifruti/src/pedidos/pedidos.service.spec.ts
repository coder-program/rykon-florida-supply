import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { PedidosService } from './pedidos.service';

const item = (extra: object = {}) => ({
  id: 'i1',
  produtoId: 'a',
  loteId: 'l1',
  quantidade: 2,
  valorUnitario: 30,
  produto: { nome: 'Morango', custo: 20 },
  lote: { numero: '7', dataEntrada: 'd' },
  ...extra,
});

const pedido = (extra: object = {}) => ({
  id: 'p',
  numero: 5,
  status: 'AGUARDANDO_APROVACAO',
  statusPagamento: 'EM_ABERTO',
  clienteId: 'c',
  vendedorId: 'v',
  entregadorId: null,
  data: new Date('2026-11-07T15:00:00Z'),
  dataVencimento: null,
  valorFrete: 10,
  descontoValor: 0,
  totalFinal: 70,
  freteInclusoNoPreco: false,
  formaPagamento: 'PIX',
  condicaoNegociada: null,
  necessitaNF: false,
  necessitaRecibo: false,
  observacoes: null,
  caixasEtiquetadas: 0,
  precosRevenda: null,
  cliente: { razaoSocialOuNome: 'Mercado', revendedorId: null },
  vendedor: { papel: 'VENDEDOR' },
  etiqueta: { id: 'e' },
  itens: [item()],
  solicitacoesAlteracao: [],
  ...extra,
});

describe('PedidosService', () => {
  let prisma: PrismaMock;
  let estoque: Record<string, ReturnType<typeof vi.fn>>;
  let etiquetas: Record<string, ReturnType<typeof vi.fn>>;
  let storage: Record<string, ReturnType<typeof vi.fn>>;
  let notificacoes: Record<string, ReturnType<typeof vi.fn>>;
  let service: PedidosService;

  beforeEach(() => {
    prisma = criarPrismaMock();
    estoque = {
      validarDisponibilidade: vi.fn(),
      baixarLoteEmTx: vi.fn(),
      devolverAoLoteEmTx: vi.fn(),
      devolverDoPedidoEmTx: vi.fn(),
      lotesUtilizadosNoPedido: vi.fn(async () => 'rastreio'),
    };
    etiquetas = { garantirParaPedido: vi.fn(async () => ({ id: 'nova' })) };
    storage = { salvarDataUrl: vi.fn(async () => '/uploads/f.jpg') };
    notificacoes = { pedidoACaminho: vi.fn(async () => undefined) };
    service = new PedidosService(
      prisma as any,
      estoque as any,
      etiquetas as any,
      storage as any,
      notificacoes as any,
    );
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    prisma.logAuditoria.findMany.mockResolvedValue([]);
    prisma.itemPedidoLote.findMany.mockResolvedValue([]);
    prisma.cliente.findUnique.mockResolvedValue({ revendedorId: null });
    prisma.movimentacaoEstoque.create.mockResolvedValue({ id: 'mov' });
    prisma.pedido.create.mockImplementation(async ({ data }: any) => ({
      id: 'p',
      numero: 5,
      ...data,
    }));
    prisma.pedido.update.mockImplementation(async ({ data }: any) => ({ id: 'p', ...data }));
  });

  describe('criar', () => {
    const dto = (extra: object = {}) =>
      ({
        clienteId: 'c',
        formaPagamento: 'PIX',
        itens: [{ produtoId: 'a', loteId: 'l1', quantidade: 2, valorUnitario: 30 }],
        ...extra,
      }) as any;

    it('lote repetido, cliente inexistente ou de outro revendedor', async () => {
      await expect(
        service.create(
          dto({
            itens: [
              { produtoId: 'a', loteId: 'l', quantidade: 1, valorUnitario: 1 },
              { produtoId: 'a', loteId: 'l', quantidade: 1, valorUnitario: 1 },
            ],
          }),
          'v',
        ),
      ).rejects.toThrow('mesmo lote foi escolhido duas vezes');
      prisma.cliente.findUnique.mockResolvedValueOnce(null);
      await expect(service.create(dto(), 'v')).rejects.toThrow('Cliente não encontrado');
      prisma.cliente.findUnique.mockResolvedValueOnce({ revendedorId: 'r' });
      await expect(service.create(dto(), 'v')).rejects.toThrow('não pode ser usado neste pedido');
      prisma.cliente.findUnique.mockResolvedValueOnce({ revendedorId: 'outro' });
      await expect(service.create(dto(), 'r', { papel: 'REVENDEDOR' })).rejects.toThrow(
        'não pode ser usado',
      );
    });

    it('calcula totais, baixa o lote e registra o status', async () => {
      const p: any = await service.create(
        dto({
          valorFrete: 10,
          descontoValor: 5,
          dataVencimento: '2026-11-20',
          necessitaRecibo: true,
        }),
        'v',
      );
      expect(p).toMatchObject({
        subtotal: 60,
        valorFrete: 10,
        descontoValor: 5,
        totalFinal: 65,
        necessitaRecibo: true,
        origem: 'VENDEDOR',
      });
      expect(estoque.baixarLoteEmTx.mock.calls[0][1]).toMatchObject({
        loteId: 'l1',
        quantidade: 2,
        valorUnitario: 30,
      });
      expect(prisma.historicoStatusPedido.create).toHaveBeenCalled();

      const pct: any = await service.create(dto({ descontoPercentual: 10 }), 'v');
      expect(pct).toMatchObject({ descontoValor: 6, totalFinal: 54, necessitaNF: false });
      const sem: any = await service.create(
        dto({ itens: [{ produtoId: 'a', quantidade: 1, valorUnitario: 9 }] }),
        'v',
      );
      expect(sem).toMatchObject({ descontoValor: 0, totalFinal: 9 });
    });

    it('portal: sem vendedor, sem baixa', async () => {
      await service.create(dto(), null, { origem: 'CLIENTE', clienteId: 'c' });
      expect(estoque.baixarLoteEmTx).not.toHaveBeenCalled();
      expect(prisma.pedido.create.mock.calls[0][0].data.origem).toBe('CLIENTE');
    });

    it('revendedor: guarda o preço dele e o pedido sai com o preço da Flórida', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ revendedorId: 'r' });
      prisma.loteProduto.findMany.mockResolvedValue([{ id: 'l1', precoSugeridoVenda: 25 }]);
      prisma.produto.findMany.mockResolvedValue([{ id: 'b', precoSugerido: 18 }]);
      const p: any = await service.create(
        dto({
          valorFrete: 10,
          descontoPercentual: 5,
          itens: [
            { produtoId: 'a', loteId: 'l1', quantidade: 2, valorUnitario: 40 },
            { produtoId: 'a', loteId: 'l2', quantidade: 1, valorUnitario: 99 },
            { produtoId: 'b', quantidade: 1, valorUnitario: 'x' },
            { produtoId: 'z', quantidade: 1, valorUnitario: 1 },
          ],
        }),
        'r',
        { papel: 'REVENDEDOR' },
      );
      expect(p.precosRevenda).toEqual({ a: 40, b: 0, z: 1 });
      expect(p.itens.create.map((i: any) => i.valorUnitario)).toEqual([25, 0, 18, 0]);
      expect(p).toMatchObject({ valorFrete: 0, descontoValor: 0, descontoPercentual: null });
    });
  });

  it('lista com filtros; vendedor só os dele; revendedor sem custo', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      pedido({ solicitacoesAlteracao: [{ id: 's' }], itens: [item(), item({ produto: null })] }),
      pedido({ itens: undefined }),
    ]);
    await service.findAll({
      vendedorId: 'x',
      clienteId: 'c',
      status: 'APROVADO',
      formaPagamento: 'PIX',
      necessitaNF: false,
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30',
    } as any);
    expect(prisma.pedido.findMany.mock.calls[0][0].where).toMatchObject({
      vendedorId: 'x',
      clienteId: 'c',
      necessitaNF: false,
    });

    const [rev, semItens]: any[] = await service.findAll(
      { vendedorId: 'x' } as any,
      'r',
      'REVENDEDOR',
    );
    expect(prisma.pedido.findMany.mock.calls[1][0].where.vendedorId).toBe('r');
    expect(rev.aguardandoAlteracao).toBe(true);
    expect(rev.itens[0].produto.custo).toBeUndefined();
    expect(rev.itens[1].produto).toBeNull();
    expect(rev.etiqueta).toBeUndefined();
    expect(semItens.etiqueta).toEqual({ id: 'e' });

    await service.findAll({ dataInicio: '2026-11-01' } as any);
    expect(prisma.pedido.findMany.mock.calls[2][0].where.data.lte).toBeUndefined();
    await service.findAll({ dataFim: '2026-11-30' } as any);
    await service.findAll();
  });

  it('detalhe: acesso, devoluções e revendedor', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('p')).rejects.toThrow('Pedido não encontrado');
    await expect(service.findOne('p', 'outro', 'VENDEDOR')).rejects.toThrow('não tem acesso');

    prisma.logAuditoria.findMany.mockResolvedValue([
      {
        id: 'd1',
        data: 'd',
        usuario: { nome: 'Zé' },
        detalhes: {
          status: 'CONCLUIDA',
          etiquetaToken: 't',
          itens: [{ produtoId: 'a', quantidade: 1 }, { produtoId: '', quantidade: 1 }, null],
          itensDevolvidos: 'x',
          quantidadeCaixas: 1,
          valorDevolucao: 30,
          observacao: 'o',
          resposta: 'r',
          fotos: ['f'],
        },
      },
      { id: 'd2', data: 'd', usuario: null, detalhes: { status: 'X', quantidadeCaixas: '1' } },
      { id: 'd3', data: 'd', detalhes: null },
    ]);
    const p: any = await service.findOne('p', 'v', 'VENDEDOR');
    expect(p.devolucoes[0]).toMatchObject({
      status: 'CONCLUIDA',
      etiquetaToken: 't',
      quantidadeCaixas: 1,
      fotos: ['f'],
      registradoPor: 'Zé',
    });
    expect(p.devolucoes[0].itens).toHaveLength(1);
    expect(p.devolucoes[1]).toMatchObject({
      status: 'PENDENTE',
      etiquetaToken: null,
      quantidadeCaixas: null,
      registradoPor: null,
      fotos: [],
    });
    expect(p.aguardandoAlteracao).toBe(false);

    prisma.pedido.findUnique.mockResolvedValue(
      pedido({
        vendedorId: 'r',
        cliente: null,
        solicitacoesAlteracao: [{ status: 'NEGADA' }, { status: 'PENDENTE' }],
      }),
    );
    const rev: any = await service.findOne('p', 'r', 'REVENDEDOR');
    expect(rev).toMatchObject({ cliente: null, aguardandoAlteracao: true });
    prisma.pedido.findUnique.mockResolvedValue(
      pedido({
        vendedorId: 'r',
        cliente: { razaoSocialOuNome: 'M', revendedorId: null, cnpjCpf: '1' },
      }),
    );
    expect(
      ((await service.findOne('p', 'r', 'REVENDEDOR')) as any).cliente.cnpjCpf,
    ).toBeUndefined();
  });

  it('preços de revenda e rastreio', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ precosRevenda: { a: 40 } }));
    await expect(
      service.atualizarPrecosRevenda('p', [{ produtoId: 'z', valor: 1 }], 'v', 'ADMINISTRADOR'),
    ).rejects.toThrow('não pertence ao pedido');
    await service.atualizarPrecosRevenda(
      'p',
      [{ produtoId: 'a', valor: 'x' as any }],
      'v',
      'ADMINISTRADOR',
    );
    expect(prisma.pedido.update.mock.calls[0][0].data.precosRevenda).toEqual({ a: 0 });
    prisma.pedido.findUnique.mockResolvedValue(pedido());
    await service.atualizarPrecosRevenda(
      'p',
      [{ produtoId: 'a', valor: 45 }],
      'v',
      'ADMINISTRADOR',
    );
    expect(prisma.pedido.update.mock.calls[1][0].data.precosRevenda).toEqual({ a: 45 });

    expect(await service.rastreioLotes('p')).toBe('rastreio');
  });

  it('na subida, baixa os pendentes antigos que ainda não tiraram do lote', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      pedido({ id: 'semVendedor', vendedorId: null }),
      pedido({ id: 'jaBaixado' }),
      pedido({ id: 'sobrou' }),
      pedido({ id: 'baixar' }),
      pedido({ id: 'semSaldo' }),
    ]);
    prisma.itemPedidoLote.findMany.mockImplementation(
      async ({ where }: any) =>
        ({
          jaBaixado: [{ loteId: 'l1', produtoId: 'a', quantidade: 2, valorUnitario: 30 }],
          sobrou: [{ loteId: 'l1', produtoId: 'a', quantidade: 5, valorUnitario: 30 }],
        })[where.pedidoId as string] ?? [],
    );
    estoque.validarDisponibilidade.mockImplementation(async () => {
      if (prisma.itemPedidoLote.findMany.mock.calls.at(-1)?.[0].where.pedidoId === 'semSaldo') {
        throw new Error('Sem estoque');
      }
    });
    await service.onApplicationBootstrap();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(estoque.baixarLoteEmTx).toHaveBeenCalledTimes(1);

    estoque.validarDisponibilidade.mockRejectedValue('texto');
    prisma.pedido.findMany.mockResolvedValue([pedido()]);
    await service.onApplicationBootstrap();
  });

  describe('editar', () => {
    it('bloqueios de status, perfil e itens', async () => {
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'CANCELADO' }));
      await expect(service.atualizar('p', {}, 'u', 'ADMINISTRADOR')).rejects.toThrow(
        'neste status',
      );
      await expect(service.atualizar('p', {}, 'v', 'VENDEDOR')).rejects.toThrow(
        'solicitação de alteração',
      );
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'ENTREGUE' }));
      await expect(
        service.atualizar('p', { itens: [] } as any, 'u', 'ADMINISTRADOR'),
      ).rejects.toThrow('Pedido entregue');
      await expect(
        service.atualizar('p', { itens: [], precos: [] } as any, 'u', 'ADMINISTRADOR'),
      ).rejects.toThrow('não os dois');
      await expect(
        service.atualizar('p', { precos: [{ itemId: 'x', valorUnitario: 1 }] } as any, 'u'),
      ).rejects.toThrow('não pertence ao pedido');
      await expect(service.atualizar('p', { itens: [] } as any, 'u')).rejects.toThrow(
        'pelo menos um produto',
      );
      await expect(
        service.atualizar(
          'p',
          { itens: [{ produtoId: 'a', quantidade: 0, valorUnitario: 1 }] } as any,
          'u',
        ),
      ).rejects.toThrow('maior que zero');
    });

    it('troca de cliente e vendedor', async () => {
      prisma.usuario.findUnique.mockResolvedValueOnce(null);
      await expect(service.atualizar('p', { vendedorId: 'x' } as any, 'u')).rejects.toThrow(
        'Vendedor inválido',
      );
      prisma.usuario.findUnique.mockResolvedValueOnce({ papel: 'MOTORISTA', ativo: true });
      await expect(service.atualizar('p', { vendedorId: 'x' } as any, 'u')).rejects.toThrow(
        'Vendedor inválido',
      );
      prisma.usuario.findUnique.mockResolvedValueOnce({ papel: 'REVENDEDOR', ativo: true });
      await expect(service.atualizar('p', { vendedorId: 'x' } as any, 'u')).rejects.toThrow(
        'entre vendedor da Flórida e revendedor',
      );

      prisma.usuario.findUnique.mockResolvedValue({ papel: 'SUPERVISOR', ativo: true });
      await service.atualizar(
        'p',
        { vendedorId: 's', clienteId: 'c2', data: '2026-11-06' } as any,
        'u',
      );
      const log = prisma.logAuditoria.create.mock.calls[0][0].data.detalhes;
      expect(log).toEqual({
        clienteAntes: 'c',
        clienteDepois: 'c2',
        vendedorAntes: 'v',
        vendedorDepois: 's',
      });
      expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({
        clienteId: 'c2',
        vendedorId: 's',
      });

      // Só cliente, pedido sem vendedor
      prisma.pedido.findUnique.mockResolvedValue(pedido({ vendedorId: null, vendedor: null }));
      await service.atualizar('p', { clienteId: 'c3' } as any, 'u');
      expect(prisma.usuario.findUnique).toHaveBeenCalledTimes(4);
    });

    it('preço do produto em pedido entregue', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedido({
          status: 'ENTREGUE',
          itens: [item(), item({ id: 'i2', produtoId: 'b', loteId: null })],
        }),
      );
      await service.atualizar(
        'p',
        {
          precos: [
            { itemId: 'i1', valorUnitario: 35 },
            { itemId: 'i2', valorUnitario: 30 },
          ],
        } as any,
        'u',
      );
      expect(prisma.itemPedido.update.mock.calls).toEqual([
        [{ where: { id: 'i1' }, data: { valorUnitario: 35, valorTotal: 70 } }],
      ]);
      expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({
        subtotal: 130,
        totalFinal: 140,
      });
      expect(prisma.logAuditoria.create.mock.calls[0][0].data.detalhes.precos).toEqual([
        { itemId: 'i1', produto: 'Morango', antes: 30, depois: 35 },
      ]);
    });

    it('troca de itens confere a diferença do lote e mantém o lote antigo', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedido({
          itens: [
            item(),
            item({ id: 'i2', produtoId: 'b', loteId: 'lb1' }),
            item({ id: 'i3', produtoId: 'b', loteId: 'lb2' }),
          ],
        }),
      );
      prisma.itemPedidoLote.findMany.mockResolvedValue([
        { loteId: 'l1', produtoId: 'a', quantidade: 2, valorUnitario: 30 },
      ]);
      await service.atualizar(
        'p',
        {
          descontoPercentual: 10,
          valorFrete: 0,
          itens: [
            { produtoId: 'a', quantidade: 3, valorUnitario: 30 },
            { produtoId: 'b', quantidade: 1, valorUnitario: 10 },
            { produtoId: 'c', loteId: '', quantidade: 1, valorUnitario: 10 },
          ],
        } as any,
        'u',
      );
      const criados = prisma.itemPedido.createMany.mock.calls[0][0].data;
      expect(criados.map((i: any) => i.loteId)).toEqual(['l1', null, null]);
      expect(estoque.validarDisponibilidade).toHaveBeenCalledWith([
        { produtoId: 'a', loteId: 'l1', quantidade: 1 },
      ]);
      expect(estoque.validarDisponibilidade).toHaveBeenCalledWith([
        expect.objectContaining({ produtoId: 'b' }),
        expect.objectContaining({ produtoId: 'c' }),
      ]);
      expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({
        subtotal: 110,
        descontoValor: 11,
        totalFinal: 99,
      });
      expect(prisma.logAuditoria.create.mock.calls[0][0].data.detalhes.itens).toHaveLength(3);
    });

    it('lote que sobrou volta ao estoque', async () => {
      prisma.itemPedidoLote.findMany.mockResolvedValue([
        { loteId: 'l1', produtoId: 'a', quantidade: 5, valorUnitario: 30 },
        { loteId: 'lx', produtoId: 'a', quantidade: 1, valorUnitario: 30 },
      ]);
      await service.atualizar(
        'p',
        { itens: [{ produtoId: 'a', loteId: 'l1', quantidade: 2, valorUnitario: 30 }] } as any,
        'u',
      );
      expect(
        estoque.devolverAoLoteEmTx.mock.calls.map((c) => [c[1].loteId, c[1].quantidade]),
      ).toEqual([
        ['l1', 3],
        ['lx', 1],
      ]);
    });
  });

  describe('aprovar', () => {
    it('status, lote obrigatório e saldo', async () => {
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'APROVADO' }));
      await expect(service.aprovar('p', 'u')).rejects.toThrow('status atual: APROVADO');
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ itens: [item({ loteId: null })] }));
      await expect(service.aprovar('p', 'u')).rejects.toThrow(
        'Selecione o lote antes de aprovar: Morango',
      );
    });

    it('aprova, gera etiqueta e avisa compra a prazo', async () => {
      prisma.etiqueta.findUnique.mockResolvedValue({ id: 'e' });
      prisma.pedido.findUnique.mockResolvedValue(
        pedido({ dataVencimento: new Date('2026-11-20') }),
      );
      const r: any = await service.aprovar('p', 'u');
      expect(r.etiqueta).toEqual({ id: 'e' });
      expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({
        status: 'APROVADO',
        caixasEtiquetadas: 2,
      });
      expect(prisma.notificacaoCliente.create.mock.calls[0][0].data.tipo).toBe('COMPRA_A_PRAZO');

      for (const extra of [
        { dataVencimento: null },
        { dataVencimento: new Date(), statusPagamento: 'PAGO' },
        { dataVencimento: new Date(), vendedor: { papel: 'REVENDEDOR' } },
        { dataVencimento: new Date(), vendedor: null, itens: [item({ quantidade: 0 })] },
      ]) {
        prisma.pedido.findUnique.mockResolvedValue(pedido(extra));
        await service.aprovar('p', 'u');
      }
      expect(prisma.notificacaoCliente.create).toHaveBeenCalledTimes(2);
      expect(prisma.pedido.update.mock.calls.at(-1)![0].data.caixasEtiquetadas).toBe(1);
    });
  });

  describe('marcar entregue', () => {
    const base = () => pedido({ status: 'EM_ENTREGA' });
    beforeEach(() => prisma.pedido.findUnique.mockResolvedValue(base()));

    it('validações', async () => {
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido());
      await expect(service.marcarEntregue('p', 'u', 'SUPERVISOR')).rejects.toThrow('neste status');
      prisma.pedido.findUnique.mockResolvedValueOnce(
        pedido({ status: 'EM_ENTREGA', solicitacoesAlteracao: [{}] }),
      );
      await expect(service.marcarEntregue('p', 'u', 'SUPERVISOR')).rejects.toThrow(
        'solicitação de alteração pendente',
      );
      await expect(service.marcarEntregue('p', 'u', 'SUPERVISOR')).rejects.toThrow(
        'foto da entrega é obrigatória',
      );
      await expect(
        service.marcarEntregue('p', 'u', 'SUPERVISOR', { fotoEntrega: 'http://x' }),
      ).rejects.toThrow('inválida');
      await expect(
        service.marcarEntregue('p', 'u', 'SUPERVISOR', {
          fotoEntrega: `data:image/png;base64,${'a'.repeat(5_500_001)}`,
        }),
      ).rejects.toThrow('muito grande');
    });

    it('escritório confirma sem foto; supervisor com foto vira comprovante', async () => {
      await service.marcarEntregue('p', 'adm', 'ADMINISTRATIVO');
      expect(prisma.comprovanteEntrega.upsert).not.toHaveBeenCalled();
      expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({
        status: 'ENTREGUE',
        recebidoPor: null,
        fotoEntrega: null,
      });

      await service.marcarEntregue('p', 's', 'SUPERVISOR', {
        fotoEntrega: ' data:image/png;base64,eA== ',
        recebidoPor: ' Ana ',
        observacaoEntrega: ' portão ',
      });
      const up = prisma.comprovanteEntrega.upsert.mock.calls[0][0];
      expect(up.create).toMatchObject({
        motoristaId: 's',
        nomeRecebedor: 'Ana',
        observacao: 'portão',
      });

      prisma.pedido.findUnique.mockResolvedValue(
        pedido({ status: 'EM_ENTREGA', entregadorId: 'm' }),
      );
      await service.marcarEntregue('p', 's', 'SUPERVISOR', {
        fotoEntrega: 'data:image/png;base64,eA==',
      });
      expect(prisma.comprovanteEntrega.upsert.mock.calls[1][0].create).toMatchObject({
        motoristaId: 'm',
        nomeRecebedor: 'Não informado',
        observacao: null,
      });
      await service.marcarEntregue('p', 'adm', 'ADMINISTRADOR');
    });
  });

  it('rejeitar devolve as caixas do lançamento', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'APROVADO' }));
    await expect(service.rejeitar('p', 'u', { motivo: 'x' })).rejects.toThrow(
      'aguardando aprovação',
    );

    prisma.itemPedidoLote.findMany.mockResolvedValue([
      { loteId: 'l1', produtoId: 'a', quantidade: 2, valorUnitario: 30 },
    ]);
    await service.rejeitar('p', 'u', { motivo: ' sem crédito ' });
    expect(prisma.pedido.update.mock.calls[0][0].data.observacoes).toBe('Rejeitado: sem crédito');
    expect(estoque.devolverAoLoteEmTx).toHaveBeenCalled();
    prisma.pedido.findUnique.mockResolvedValue(pedido({ observacoes: 'urgente' }));
    await service.rejeitar('p', 'u', { motivo: 'x' });
    expect(prisma.pedido.update.mock.calls[1][0].data.observacoes).toBe('urgente\nRejeitado: x');
  });

  it('ajuste de itens do portal só antes da aprovação', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'APROVADO' }));
    await expect(service.atualizarItensAntesAprovacao('p', [], 'u')).rejects.toThrow(
      'antes da aprovação',
    );
    const atualizar = vi.spyOn(service, 'atualizar').mockResolvedValue({} as any);
    await service.atualizarItensAntesAprovacao(
      'p',
      [{ produtoId: 'a', quantidade: 1, valorUnitario: 1 }],
      'u',
    );
    expect(atualizar).toHaveBeenCalledWith('p', expect.any(Object), 'u', 'ADMINISTRADOR');
  });

  it('atribuir vendedor e entregador', async () => {
    await expect(service.atribuir('p', {}, 'u')).rejects.toThrow('a partir de Aprovado');
    prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'CANCELADO' }));
    await expect(service.atribuir('p', {}, 'u')).rejects.toThrow('Não é possível atribuir');
    prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'REJEITADO' }));
    await expect(service.atribuir('p', {}, 'u')).rejects.toThrow('Não é possível atribuir');
    prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'APROVADO' }));
    await expect(service.atribuir('p', {}, 'u')).rejects.toThrow('Informe vendedorId');

    for (const u of [
      null,
      { papel: 'VENDEDOR', ativo: true },
      { papel: 'MOTORISTA', ativo: false },
    ]) {
      prisma.usuario.findUnique.mockResolvedValueOnce(u);
      await expect(service.atribuir('p', { entregadorId: 'm' }, 'u')).rejects.toThrow(
        'motorista ou supervisor ativo',
      );
    }
    for (const u of [
      null,
      { papel: 'MOTORISTA', ativo: true },
      { papel: 'VENDEDOR', ativo: false },
    ]) {
      prisma.usuario.findUnique.mockResolvedValueOnce(u);
      await expect(service.atribuir('p', { vendedorId: 'v' }, 'u')).rejects.toThrow(
        'Vendedor inválido',
      );
    }

    prisma.usuario.findUnique.mockResolvedValue({ papel: 'SUPERVISOR', ativo: true });
    await service.atribuir('p', { entregadorId: 's', vendedorId: 's' }, 'u');
    expect(prisma.pedido.update.mock.calls[0][0].data).toEqual({
      vendedorId: 's',
      entregadorId: 's',
    });
    prisma.usuario.findUnique.mockResolvedValue({ papel: 'MOTORISTA', ativo: true });
    await service.atribuir('p', { entregadorId: 'm' }, 'u');
    expect(prisma.logAuditoria.create.mock.calls[1][0].data.detalhes).toEqual({
      vendedorId: null,
      entregadorId: 'm',
    });
    prisma.usuario.findUnique.mockResolvedValue({ papel: 'VENDEDOR', ativo: true });
    await service.atribuir('p', { vendedorId: 'v' }, 'u');
  });

  describe('mudar status', () => {
    it('bloqueado com alteração pendente', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ solicitacoesAlteracao: [{}] }));
      await expect(service.atualizarStatus('p', 'APROVADO', 'u')).rejects.toThrow(
        'alteração pendente',
      );
    });

    it('cancelar pendente devolve só o lançamento; aprovado ou entregue devolve os itens', async () => {
      prisma.itemPedidoLote.findMany.mockResolvedValue([
        { loteId: 'l1', produtoId: 'a', quantidade: 2, valorUnitario: 30 },
      ]);
      await service.cancelar('p', 'u');
      expect(estoque.devolverAoLoteEmTx).toHaveBeenCalledTimes(1);
      expect(estoque.devolverDoPedidoEmTx).not.toHaveBeenCalled();

      for (const status of ['APROVADO', 'ENTREGUE']) {
        prisma.pedido.findUnique.mockResolvedValue(pedido({ status }));
        await service.cancelar('p', 'u');
      }
      expect(estoque.devolverDoPedidoEmTx).toHaveBeenCalledTimes(2);
      expect(estoque.devolverDoPedidoEmTx.mock.calls[0][1]).toMatchObject({
        quantidade: 2,
        loteIdPreferido: 'l1',
      });

      prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'REJEITADO' }));
      await service.cancelar('p', 'u');
      expect(estoque.devolverDoPedidoEmTx).toHaveBeenCalledTimes(2);
    });

    it('sair para entrega avisa o cliente uma vez', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'PRONTO_PARA_ENTREGA' }));
      await service.atualizarStatus('p', 'EM_ENTREGA', 'u');
      prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'EM_ENTREGA' }));
      await service.atualizarStatus('p', 'EM_ENTREGA', 'u');
      await service.atualizarStatus('p', 'PRONTO_PARA_ENTREGA', 'u');
      expect(notificacoes.pedidoACaminho).toHaveBeenCalledTimes(1);
    });
  });

  describe('excluir', () => {
    const excluivel = (extra: object = {}) => ({
      ...pedido(),
      cliente: { razaoSocialOuNome: 'M' },
      pagamentos: [{ valor: 10 }],
      ...extra,
    });

    it('validações', async () => {
      prisma.pedido.findUnique.mockResolvedValueOnce(null);
      await expect(service.excluir('p', 'u')).rejects.toThrow('Pedido não encontrado');
      prisma.pedido.findUnique.mockResolvedValueOnce(excluivel({ status: 'REJEITADO' }));
      await expect(service.excluir('p', 'u')).rejects.toThrow('não pode ser excluído neste status');
      prisma.pedido.findUnique.mockResolvedValueOnce(excluivel({ statusPagamento: 'PAGO' }));
      await expect(service.excluir('p', 'u')).rejects.toThrow('está pago');
      prisma.pedido.findUnique.mockResolvedValueOnce(excluivel());
      prisma.logAuditoria.count.mockResolvedValueOnce(1);
      await expect(service.excluir('p', 'u')).rejects.toThrow('devolução registrada');
    });

    it('cancela antes e apaga mantendo o histórico', async () => {
      const cancelar = vi.spyOn(service, 'atualizarStatus').mockResolvedValue({} as any);
      prisma.logAuditoria.count.mockResolvedValue(0);
      prisma.pedido.findUnique.mockResolvedValue(excluivel());
      expect(await service.excluir('p', 'u')).toEqual({ ok: true });
      expect(cancelar).toHaveBeenCalledWith('p', 'CANCELADO', 'u');
      expect(prisma.movimentacaoEstoque.updateMany.mock.calls[0][0].data).toEqual({
        pedidoId: null,
      });
      expect(prisma.logAuditoria.create.mock.calls[0][0].data.detalhes).toMatchObject({
        cliente: 'M',
        pagamentosRemovidos: [10],
      });

      prisma.pedido.findUnique.mockResolvedValue(excluivel({ status: 'CANCELADO', cliente: null }));
      await service.excluir('p', 'u');
      expect(cancelar).toHaveBeenCalledTimes(1);
      for (const status of ['ENTREGUE', 'EM_ENTREGA']) {
        prisma.pedido.findUnique.mockResolvedValue(excluivel({ status }));
        await service.excluir('p', 'u');
      }
      expect(cancelar).toHaveBeenCalledTimes(3);
    });
  });

  describe('solicitação de alteração', () => {
    const aprovado = (extra: object = {}) => pedido({ status: 'APROVADO', ...extra });

    it('quando e o que pode ser alterado', async () => {
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'EM_ENTREGA' }));
      await expect(service.solicitarAlteracao('p', { itens: [] } as any, 'u')).rejects.toThrow(
        'saiu para entrega',
      );
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'ENTREGUE' }));
      await expect(
        service.solicitarAlteracao('p', { itens: [] } as any, 'v', 'VENDEDOR'),
      ).rejects.toThrow('saiu para entrega');

      prisma.pedido.findUnique.mockResolvedValue(aprovado());
      prisma.solicitacaoAlteracaoPedido.findFirst.mockResolvedValueOnce({ id: 's' });
      await expect(service.solicitarAlteracao('p', { itens: [] } as any, 'u')).rejects.toThrow(
        'Já existe uma solicitação',
      );
      await expect(service.solicitarAlteracao('p', { itens: [] } as any, 'u')).rejects.toThrow(
        'Informe os produtos',
      );
      await expect(
        service.solicitarAlteracao('p', { itens: [{ produtoId: 'z', quantidade: 1 }] } as any, 'u'),
      ).rejects.toThrow('já presentes no pedido');
      await expect(
        service.solicitarAlteracao('p', { itens: [{ produtoId: 'a', quantidade: 2 }] } as any, 'u'),
      ).rejects.toThrow('igual à atual');
      await expect(
        service.solicitarAlteracao('p', { itens: [{ produtoId: 'a', quantidade: 0 }] } as any, 'u'),
      ).rejects.toThrow('maior que zero');

      prisma.pedido.findUnique.mockResolvedValue(
        aprovado({ itens: [item(), item({ id: 'i2', loteId: 'l2' })] }),
      );
      await expect(
        service.solicitarAlteracao('p', { itens: [{ produtoId: 'a', quantidade: 1 }] } as any, 'u'),
      ).rejects.toThrow('Informe o lote');
    });

    it('cria a solicitação conferindo o estoque do aumento', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedido({
          status: 'ENTREGUE',
          itens: [item(), item({ id: 'i2', produtoId: 'b', loteId: null, lote: null })],
        }),
      );
      prisma.solicitacaoAlteracaoPedido.create.mockImplementation(async ({ data }: any) => ({
        id: 's',
        ...data,
      }));
      const r: any = await service.solicitarAlteracao(
        'p',
        {
          itens: [
            { produtoId: 'a', loteId: 'l1', quantidade: 4 },
            { produtoId: 'b', quantidade: 1 },
          ],
          observacao: 'x',
        } as any,
        'u',
        'SUPERVISOR',
      );
      expect(estoque.validarDisponibilidade).toHaveBeenCalledWith([
        { produtoId: 'a', quantidade: 2, loteId: 'l1' },
      ]);
      expect(r).toMatchObject({ quantidadeOriginal: 4, quantidadeSolicitada: 5, delta: 1 });
      expect(r.itens[1]).toMatchObject({ loteNumero: null, loteData: null });

      prisma.pedido.findUnique.mockResolvedValue(aprovado());
      await service.solicitarAlteracao(
        'p',
        { itens: [{ produtoId: 'a', quantidade: 1 }] } as any,
        'u',
      );
      expect(estoque.validarDisponibilidade).toHaveBeenCalledTimes(1);
    });

    it('listas', async () => {
      prisma.solicitacaoAlteracaoPedido.findMany.mockResolvedValue([
        { itens: null },
        { itens: [{ quantidadeOriginal: 2 }] },
      ]);
      const r = await service.listarSolicitacoes({ status: 'PENDENTE' } as any, 'v', 'VENDEDOR');
      expect(prisma.solicitacaoAlteracaoPedido.findMany.mock.calls[0][0].where).toEqual({
        status: 'PENDENTE',
        solicitanteId: 'v',
      });
      expect(r[1]).toMatchObject({ quantidadeOriginal: 2, quantidadeSolicitada: 0, delta: -2 });
      await service.listarSolicitacoes();
      expect(prisma.solicitacaoAlteracaoPedido.findMany.mock.calls[1][0].where).toEqual({});
      await service.listarSolicitacoesDoPedido('p');
    });

    const solicitacao = (extra: object = {}) => ({
      id: 's',
      status: 'PENDENTE',
      pedidoId: 'p',
      pedido: { caixasEtiquetadas: 0 },
      itens: [{ produtoId: 'a', loteId: 'l1', quantidadeOriginal: 2, quantidadeSolicitada: 4 }],
      ...extra,
    });

    it('aprovar aplica no lote e calcula as etiquetas extras', async () => {
      await expect(service.aprovarSolicitacao('s', 'u')).rejects.toThrow(
        'Solicitação não encontrada',
      );
      prisma.solicitacaoAlteracaoPedido.findUnique.mockResolvedValueOnce(
        solicitacao({ status: 'APROVADA' }),
      );
      await expect(service.aprovarSolicitacao('s', 'u')).rejects.toThrow('já foi respondida');

      prisma.solicitacaoAlteracaoPedido.findUnique.mockResolvedValue(solicitacao());
      prisma.solicitacaoAlteracaoPedido.update.mockReturnValue({ id: 's', itens: [] });
      prisma.pedido.findUnique.mockResolvedValue(
        pedido({ status: 'APROVADO', etiqueta: { id: 'e' } }),
      );
      prisma.pedido.update.mockImplementation(async ({ data, include }: any) =>
        include ? { etiqueta: { id: 'e' }, itens: [{ quantidade: 4 }], ...data } : data,
      );
      const r: any = await service.aprovarSolicitacao('s', 'u');
      expect(r).toMatchObject({ etiquetasExtras: { de: 3, ate: 4 }, etiquetaId: 'e' });
      expect(estoque.baixarLoteEmTx.mock.calls[0][1]).toMatchObject({
        quantidade: 2,
        loteId: 'l1',
      });

      // Já tinha etiquetas impressas e a quantidade diminuiu
      prisma.solicitacaoAlteracaoPedido.findUnique.mockResolvedValue(
        solicitacao({
          pedido: { caixasEtiquetadas: 4 },
          itens: [{ produtoId: 'a', quantidadeOriginal: 2, quantidadeSolicitada: 1 }],
        }),
      );
      prisma.pedido.update.mockImplementation(async ({ data, include }: any) =>
        include ? { etiqueta: null, itens: [{ quantidade: 1 }], ...data } : data,
      );
      const r2: any = await service.aprovarSolicitacao('s', 'u');
      expect(r2).toMatchObject({ etiquetasExtras: null, etiquetaId: 'nova' });
      expect(estoque.devolverDoPedidoEmTx.mock.calls[0][1]).toMatchObject({ quantidade: 1 });
    });

    it('aplicar: pedido antigo sem lote, linhas sem mudança e sem lote para baixar', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedido({
          valorFrete: 0,
          itens: [
            item({ id: 'i1', loteId: 'l1' }),
            item({ id: 'i2', produtoId: 'b', loteId: null, produto: { nome: 'Uva' } }),
            item({ id: 'i3', produtoId: 'c' }),
          ],
        }),
      );
      prisma.pedido.update.mockImplementation(async ({ data }: any) => data);
      const aplicar = (alt: object[]) => (service as any).aplicarItensAposAprovacao('p', alt, 'u');
      // Solicitação sem lote casa com a linha do produto
      const r = await aplicar([{ produtoId: 'a', loteId: null, quantidade: 3 }]);
      // a: 3 x 30 (alterado) + b e c: 2 x 30 cada (sem mudança)
      expect(r).toMatchObject({ subtotal: 210, totalFinal: 210 });
      await expect(aplicar([{ produtoId: 'b', loteId: null, quantidade: 5 }])).rejects.toThrow(
        'Selecione o lote de Uva',
      );
    });

    it('negar', async () => {
      await expect(service.negarSolicitacao('s', 'u')).rejects.toThrow('não encontrada');
      prisma.solicitacaoAlteracaoPedido.findUnique.mockResolvedValueOnce(
        solicitacao({ status: 'NEGADA' }),
      );
      await expect(service.negarSolicitacao('s', 'u')).rejects.toThrow('já foi respondida');
      prisma.solicitacaoAlteracaoPedido.findUnique.mockResolvedValue(solicitacao());
      prisma.solicitacaoAlteracaoPedido.update.mockResolvedValue({ itens: [] });
      await service.negarSolicitacao('s', 'u', ' sem estoque ');
      expect(prisma.solicitacaoAlteracaoPedido.update.mock.calls[0][0].data.resposta).toBe(
        'sem estoque',
      );
      await service.negarSolicitacao('s', 'u');
      expect(prisma.solicitacaoAlteracaoPedido.update.mock.calls[1][0].data.resposta).toBeNull();
    });
  });
});
