import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { EstoqueService } from './estoque.service';

const DIA = new Date('2026-11-18T15:00:00Z'); // 18/11, meio-dia em Brasília

describe('EstoqueService', () => {
  let prisma: PrismaMock;
  let service: EstoqueService;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(DIA);
    prisma = criarPrismaMock();
    service = new EstoqueService(prisma as any);
  });
  afterEach(() => vi.useRealTimers());

  describe('rateio de frete e comissão', () => {
    it('divide pelo valor e fecha os centavos no último', () => {
      const r = service.calcularRateio(
        [
          { produtoId: 'a', quantidade: 1, valorProduto: 100 },
          { produtoId: 'b', quantidade: 2, valorProduto: 100 },
        ],
        10,
        0.01,
      );
      expect(r.map((i) => i.rateioFrete)).toEqual([3.33, 6.67]);
      expect(r[1]).toMatchObject({ custoTotalItem: 206.68, custoUnitarioFinal: 103.34 });
    });
    it('sem valor divide igual; sem frete e comissão', () => {
      const r = service.calcularRateio(
        [
          { produtoId: 'a', quantidade: 1, valorProduto: 0 },
          { produtoId: 'b', quantidade: 1, valorProduto: 0 },
        ],
        10,
      );
      expect(r.map((i) => i.rateioFrete)).toEqual([5, 5]);
      const s = service.calcularRateio([{ produtoId: 'a', quantidade: 0, valorProduto: 0 } as any]);
      expect(s[0].rateioFrete).toBe(0);
    });
  });

  it('sugere o próximo número de lote do dia', async () => {
    prisma.loteProduto.findMany.mockResolvedValue([
      { numero: '1' },
      { numero: '3' },
      { numero: 'A' },
    ]);
    expect(await service.sugerirNumeroLote('2026-11-10')).toEqual({ numero: '4' });
    prisma.loteProduto.findMany.mockResolvedValue([]);
    expect(await service.sugerirNumeroLote()).toEqual({ numero: '1' });
    expect(prisma.loteProduto.findMany.mock.calls[1][0].where.dataEntrada.gte).toEqual(
      new Date('2026-11-18T03:00:00Z'),
    );
    await service.sugerirNumeroLote('lixo');
  });

  describe('registrar entrada', () => {
    const item = (extra: object = {}) => ({
      produtoId: 'a',
      quantidade: 10,
      valorProduto: 20,
      ...extra,
    });
    beforeEach(() => {
      prisma.produto.findMany.mockImplementation(async ({ where }: any) =>
        where.id.in.map((id: string) => ({ id })),
      );
      prisma.loteProduto.findMany.mockResolvedValue([]);
      prisma.compraEstoque.create.mockResolvedValue({ id: 'c' });
      prisma.movimentacaoEstoque.create.mockResolvedValue({ id: 'mov' });
      prisma.loteProduto.create.mockResolvedValue({ id: 'lote' });
      prisma.compraEstoque.findUnique.mockResolvedValue({ id: 'c' });
    });

    it('validações', async () => {
      await expect(service.registrarEntrada({ usuarioId: 'u', itens: [] })).rejects.toThrow(
        'pelo menos um produto',
      );
      await expect(
        service.registrarEntrada({ usuarioId: 'u', itens: undefined as any }),
      ).rejects.toThrow('pelo menos um produto');
      prisma.produto.findMany.mockResolvedValueOnce([]);
      await expect(service.registrarEntrada({ usuarioId: 'u', itens: [item()] })).rejects.toThrow(
        'não existem',
      );
      await expect(service.registrarEntrada({ usuarioId: 'u', itens: [item()] })).rejects.toThrow(
        'Selecione o fornecedor',
      );
      await expect(
        service.registrarEntrada({ usuarioId: 'u', fornecedorId: 'f', itens: [item()] }),
      ).rejects.toThrow('Fornecedor não encontrado');
      await expect(
        service.registrarEntrada({
          usuarioId: 'u',
          fornecedor: 'Ceasa',
          itens: [item(), item({ quantidade: 1 })],
        }),
      ).rejects.toThrow('aparece duas vezes no lote 1');
      prisma.loteProduto.findFirst.mockResolvedValueOnce({ produto: { nome: 'Morango' } });
      await expect(
        service.registrarEntrada({
          usuarioId: 'u',
          fornecedor: 'Ceasa',
          numeroLote: '7',
          itens: [item()],
        }),
      ).rejects.toThrow('Já existe o lote 7 de Morango nesse dia');
    });

    it('cria compra, movimentação, lote e atualiza o custo', async () => {
      prisma.fornecedor.findUnique.mockResolvedValue({ id: 'f', nome: 'Ceasa' });
      const r = await service.registrarEntrada({
        usuarioId: 'u',
        fornecedorId: 'f',
        valorFrete: 10,
        dataLote: '2026-11-17',
        itens: [
          item({ precoSugeridoVenda: 30 }),
          item({ produtoId: 'b', numeroLote: ' 9 ' }),
          item({ produtoId: '', quantidade: 5 }),
        ],
      });
      expect(r).toEqual({ id: 'c' });
      expect(prisma.compraEstoque.create.mock.calls[0][0].data).toMatchObject({
        fornecedor: 'Ceasa',
        fornecedorId: 'f',
        valorFrete: 10,
        valorComissao: 0,
      });
      const lotes = prisma.loteProduto.create.mock.calls.map((c: any) => c[0].data);
      expect(lotes.map((l: any) => [l.numero, l.precoSugeridoVenda])).toEqual([
        ['1', 30],
        ['9', null],
      ]);
      expect(lotes[0].dataEntrada).toEqual(new Date('2026-11-17T15:00:00Z'));
      expect(prisma.produto.update.mock.calls[0][0].data.custo).toBe(20.5);

      await service.registrarEntrada({
        usuarioId: 'u',
        fornecedor: ' Ceasa ',
        numeroLote: '5',
        itens: [item()],
      });
      expect(prisma.loteProduto.create.mock.calls[2][0].data.dataEntrada).toEqual(DIA);
    });
  });

  const compra = (itens: any[], extra: object = {}) => ({
    id: 'c',
    fornecedor: 'Ceasa',
    fornecedorId: null,
    valorFrete: 10,
    valorComissao: 0,
    observacao: 'obs',
    data: DIA,
    usuario: { nome: 'Duda' },
    itens,
    ...extra,
  });
  const itemCompra = (extra: any = {}, lote: any = {}) => ({
    id: 'ic1',
    produtoId: 'a',
    quantidade: 10,
    valorProdutoInformado: 200,
    rateioFrete: 10,
    rateioComissao: 0,
    custoUnitarioFinal: 21,
    movimentacaoId: 'mov1',
    produto: { id: 'a', nome: 'Morango', codigoInterno: 'M' },
    movimentacao:
      lote === null
        ? null
        : {
            lotes: [
              {
                id: 'ml1',
                saldoAntes: 0,
                lote: {
                  id: 'l1',
                  numero: '1',
                  dataEntrada: DIA,
                  quantidadeInicial: 10,
                  quantidadeDisponivel: 10,
                  ...lote,
                },
              },
            ],
          },
    ...extra,
  });

  it('busca compra com o lote de cada item', async () => {
    await expect(service.buscarCompra('c')).rejects.toThrow('Entrada de estoque não encontrada');
    prisma.compraEstoque.findUnique.mockResolvedValue(
      compra(
        [
          itemCompra({}, { quantidadeDisponivel: 7 }),
          itemCompra({ id: 'ic2', quantidade: 0 }, null),
        ],
        { usuario: null },
      ),
    );
    const r = await service.buscarCompra('c');
    expect(r.usuario).toBeNull();
    expect(r.itens[0]).toMatchObject({ valorUnitario: 20, lote: { quantidadeVendida: 3 } });
    expect(r.itens[1]).toMatchObject({ valorUnitario: 0, lote: null });
  });

  describe('editar entrada', () => {
    const editar = (dados: object) => service.atualizarCompra('c', dados as any, 'u');
    beforeEach(() => {
      prisma.compraEstoque.findUnique.mockResolvedValue(compra([itemCompra()]));
    });

    it('validações', async () => {
      prisma.compraEstoque.findUnique.mockResolvedValueOnce(compra([]));
      await expect(editar({})).rejects.toThrow('não tem itens');
      await expect(editar({ itens: [{ id: 'x' }] })).rejects.toThrow('Item não pertence');
      await expect(editar({ itens: [{ id: 'ic1', valorProduto: -1 }] })).rejects.toThrow(
        'Valor do produto inválido',
      );
      await expect(editar({ itens: [{ id: 'ic1', quantidade: 0 }] })).rejects.toThrow(
        'Quantidade inválida para Morango',
      );

      prisma.compraEstoque.findUnique.mockResolvedValue(
        compra([itemCompra({}, { quantidadeDisponivel: 4 })]),
      );
      await expect(editar({ itens: [{ id: 'ic1', quantidade: 5 }] })).rejects.toThrow(
        'já saíram 6 cx',
      );
      await expect(editar({ itens: [{ id: 'ic1', produtoId: 'b' }] })).rejects.toThrow(
        'não dá para trocar o produto',
      );

      prisma.compraEstoque.findUnique.mockResolvedValue(compra([itemCompra()]));
      await expect(editar({ itens: [{ id: 'ic1', produtoId: 'b' }] })).rejects.toThrow(
        'Produto não encontrado',
      );
      prisma.produto.findUnique.mockResolvedValue({ id: 'b', nome: 'Uva' });
      prisma.loteProduto.findFirst.mockResolvedValueOnce({ id: 'outro' });
      await expect(editar({ itens: [{ id: 'ic1', produtoId: 'b' }] })).rejects.toThrow(
        'Já existe o lote 1 de Uva',
      );
    });

    it('refaz o rateio e atualiza item, movimentação, lote e custo', async () => {
      prisma.movimentacaoEstoque.findFirst.mockResolvedValue({ id: 'mov1', custoUnitario: 25 });
      await editar({
        valorFrete: 50,
        valorComissao: 0,
        observacao: '  ',
        itens: [{ id: 'ic1', quantidade: 12, valorProduto: null }],
      });
      expect(prisma.compraEstoque.update.mock.calls[0][0].data).toMatchObject({
        valorFrete: 50,
        observacao: null,
        fornecedor: 'Ceasa',
      });
      expect(prisma.itemCompraEstoque.update.mock.calls[0][0].data).toMatchObject({
        quantidade: 12,
        valorProdutoInformado: 240,
      });
      expect(prisma.loteProduto.update.mock.calls[0][0].data.quantidadeDisponivel).toEqual({
        increment: 2,
      });
      expect(prisma.movimentacaoEstoqueLote.update.mock.calls[0][0].data).toEqual({
        quantidade: 12,
        saldoDepois: 12,
      });
      expect(prisma.produto.update.mock.calls[0][0].data).toEqual({ custo: 25 });
      expect(prisma.logAuditoria.create.mock.calls[0][0].data.acao).toBe('EDITAR_ENTRADA_ESTOQUE');
    });

    it('troca de produto, fornecedor do cadastro e itens sem lote/movimentação', async () => {
      prisma.fornecedor.findUnique.mockResolvedValue({ id: 'f2', nome: 'Sítio' });
      prisma.produto.findUnique.mockResolvedValue({ id: 'b', nome: 'Uva' });
      // Produto antigo volta ao custo da entrada anterior; o novo só muda se esta for a mais recente
      prisma.movimentacaoEstoque.findFirst
        .mockResolvedValueOnce({ id: 'antiga', custoUnitario: 18 })
        .mockResolvedValueOnce({ id: 'outra', custoUnitario: 30 });
      await editar({
        fornecedorId: 'f2',
        itens: [{ id: 'ic1', produtoId: 'b', valorProduto: 22 }],
      });
      expect(prisma.compraEstoque.update.mock.calls[0][0].data).toMatchObject({
        fornecedor: 'Sítio',
        fornecedorId: 'f2',
      });
      expect(prisma.produto.update.mock.calls).toEqual([
        [{ where: { id: 'a' }, data: { custo: 18 } }],
      ]);
      expect(prisma.movimentacaoEstoqueLote.update).not.toHaveBeenCalled();

      prisma.compraEstoque.findUnique.mockResolvedValue(
        compra([
          itemCompra({ movimentacaoId: null }, null),
          itemCompra({ id: 'ic2', quantidade: 0, valorProdutoInformado: 0 }, null),
          itemCompra({ id: 'ic3' }, { saldoAntes: null }),
        ]),
      );
      prisma.movimentacaoEstoque.findFirst.mockResolvedValue(null);
      await editar({
        fornecedor: ' Novo ',
        itens: [
          { id: 'ic2', quantidade: 3 },
          { id: 'ic3', quantidade: 11 },
          { id: 'ic1', produtoId: 'b' },
        ],
      });
      expect(prisma.compraEstoque.update.mock.calls[1][0].data.fornecedor).toBe('Novo');
      expect(prisma.itemCompraEstoque.update.mock.calls.at(-2)![0].data.valorProdutoInformado).toBe(
        0,
      );
    });
  });

  describe('disponibilidade', () => {
    it('lotes escolhidos: mesmo lote, produto errado, encerrado e saldo', async () => {
      await expect(
        service.validarDisponibilidade([
          { produtoId: 'a', quantidade: 1, loteId: 'l' },
          { produtoId: 'b', quantidade: 1, loteId: 'l' },
        ]),
      ).rejects.toThrow('produtos diferentes');

      prisma.loteProduto.findMany.mockResolvedValueOnce([]);
      await expect(
        service.validarDisponibilidade([{ produtoId: 'a', quantidade: 1, loteId: 'l' }]),
      ).rejects.toThrow('não pertence ao produto');
      prisma.loteProduto.findMany.mockResolvedValueOnce([
        { id: 'l', ativo: false, produtoId: 'a' },
      ]);
      await expect(
        service.validarDisponibilidade([{ produtoId: 'a', quantidade: 1, loteId: 'l' }]),
      ).rejects.toThrow('encerrado');
      prisma.loteProduto.findMany.mockResolvedValueOnce([
        {
          id: 'l',
          ativo: true,
          produtoId: 'a',
          numero: '7',
          quantidadeDisponivel: 2,
          produto: { nome: 'Morango' },
        },
      ]);
      await expect(
        service.validarDisponibilidade([
          { produtoId: 'a', quantidade: 2, loteId: 'l' },
          { produtoId: 'a', quantidade: 1, loteId: 'l' },
        ]),
      ).rejects.toThrow('Morango lote 7: disponível 2 cx, pedido 3 cx');
    });

    it('saldo total por produto', async () => {
      prisma.loteProduto.findMany
        .mockResolvedValueOnce([
          {
            id: 'l',
            ativo: true,
            produtoId: 'a',
            quantidadeDisponivel: null,
            produto: { nome: 'M' },
          },
        ])
        .mockResolvedValue([{ quantidadeDisponivel: 2 }, { quantidadeDisponivel: null }]);
      await expect(
        service.validarDisponibilidade([
          { produtoId: 'a', quantidade: 0, loteId: 'l' },
          { produtoId: 'b', quantidade: undefined as any },
        ]),
      ).resolves.toBeUndefined();

      prisma.loteProduto.findMany.mockResolvedValue([{ quantidadeDisponivel: 1 }]);
      prisma.produto.findUnique.mockResolvedValueOnce({ nome: 'Uva' }).mockResolvedValueOnce(null);
      await expect(
        service.validarDisponibilidade([
          { produtoId: 'a', quantidade: 3 },
          { produtoId: 'z', quantidade: 2 },
        ]),
      ).rejects.toThrow('Uva (pedido 3 cx, estoque em lotes 1 cx); z (pedido 2 cx');
    });
  });

  it('listas de lotes', async () => {
    await service.listarLotesProduto('a');
    prisma.loteProduto.findMany.mockResolvedValue([
      {
        id: 'l',
        numero: '1',
        dataEntrada: DIA,
        produto: { nome: 'M' },
        quantidadeInicial: '10',
        quantidadeDisponivel: '4',
        valorUnitario: '20',
        precoSugeridoVenda: '30',
        observacao: null,
        movimentacoesLote: [{ movimentacao: { itemCompra: { compraId: 'c' } } }],
        itensPedido: [
          {
            quantidade: 6,
            pedido: { id: 'p', numero: 1, data: DIA, cliente: { razaoSocialOuNome: 'M' } },
          },
          { quantidade: 1, pedido: { id: 'q', numero: 2, data: DIA, cliente: null } },
        ],
      },
      {
        id: 'l2',
        numero: '2',
        dataEntrada: DIA,
        produto: {},
        quantidadeInicial: 1,
        quantidadeDisponivel: 1,
        valorUnitario: 1,
        precoSugeridoVenda: null,
        movimentacoesLote: [{ movimentacao: { itemCompra: null } }],
        itensPedido: [],
      },
      {
        id: 'l3',
        quantidadeInicial: 1,
        quantidadeDisponivel: 1,
        valorUnitario: 1,
        movimentacoesLote: [],
        itensPedido: [],
      },
    ]);
    const r = await service.listarLotes({ produtoId: 'a', situacao: 'DISPONIVEL' });
    expect(r[0]).toMatchObject({ quantidadeVendida: 6, precoSugeridoVenda: 30, compraId: 'c' });
    expect(r[0].vendas[1].cliente).toBeNull();
    expect(r[1]).toMatchObject({ precoSugeridoVenda: null, compraId: null });
    expect(r[2].compraId).toBeNull();
    await service.listarLotes({ situacao: 'ESGOTADO' });
    expect(prisma.loteProduto.findMany.mock.calls[2][0].where).toEqual({
      quantidadeDisponivel: { lte: 0 },
    });

    prisma.loteProduto.findMany.mockResolvedValue([
      { id: 'l', quantidadeDisponivel: '3', precoSugeridoVenda: '9' },
      { id: 'm', quantidadeDisponivel: 1, precoSugeridoVenda: null },
    ]);
    expect(await service.lotesDisponiveis('a')).toEqual([
      { id: 'l', quantidadeDisponivel: 3, precoSugeridoVenda: 9 },
      { id: 'm', quantidadeDisponivel: 1, precoSugeridoVenda: null },
    ]);
    await service.lotesDisponiveis();
    expect(prisma.loteProduto.findMany.mock.calls.at(-1)![0].where.produtoId).toBeUndefined();
  });

  it('atualiza lote', async () => {
    await expect(service.atualizarLote('l', {})).rejects.toThrow('Lote não encontrado');
    prisma.loteProduto.findUnique.mockResolvedValue({
      id: 'l',
      numero: '1',
      produtoId: 'a',
      dataEntrada: DIA,
    });
    prisma.loteProduto.findFirst.mockResolvedValueOnce({ id: 'x' });
    await expect(service.atualizarLote('l', { numero: ' 2 ' })).rejects.toThrow(
      'Já existe o lote 2',
    );

    await service.atualizarLote('l', { numero: '2', observacao: '', precoSugeridoVenda: 0 });
    expect(prisma.loteProduto.update.mock.calls[0][0].data).toEqual({
      numero: '2',
      observacao: null,
      precoSugeridoVenda: null,
    });
    await service.atualizarLote('l', { numero: '1', observacao: 'x', precoSugeridoVenda: 12 });
    expect(prisma.loteProduto.update.mock.calls[1][0].data).toEqual({
      numero: '1',
      observacao: 'x',
      precoSugeridoVenda: 12,
    });
    await service.atualizarLote('l', {});
    expect(prisma.loteProduto.update.mock.calls[2][0].data).toEqual({});
  });

  describe('excluir lote', () => {
    const lote = (extra: object = {}) => ({
      id: 'l',
      produtoId: 'a',
      numero: '1',
      dataEntrada: DIA,
      quantidadeInicial: 10,
      quantidadeDisponivel: 10,
      valorUnitario: 20,
      produto: { nome: 'Morango' },
      movimentacoesLote: [
        {
          id: 'ml',
          movimentacaoId: 'mov',
          movimentacao: { itemCompra: { id: 'ic', compraId: 'c' } },
        },
      ],
      _count: { itensPedido: 0, itensSelecionados: 0, perdas: 0 },
      ...extra,
    });

    it('só lote sem uso', async () => {
      await expect(service.excluirLote('l', 'u')).rejects.toThrow('Lote não encontrado');
      for (const extra of [
        { quantidadeDisponivel: 9 },
        { movimentacoesLote: [{}, {}] },
        { _count: { itensPedido: 0, itensSelecionados: 0, perdas: 1 } },
      ]) {
        prisma.loteProduto.findUnique.mockResolvedValueOnce(lote(extra));
        await expect(service.excluirLote('l', 'u')).rejects.toThrow('edite a entrada');
      }
    });

    it('apaga a entrada e a compra que ficou vazia', async () => {
      prisma.loteProduto.findUnique.mockResolvedValue(lote());
      prisma.movimentacaoEstoque.findFirst.mockResolvedValue({ custoUnitario: 18 });
      prisma.itemCompraEstoque.count.mockResolvedValue(0);
      expect(await service.excluirLote('l', 'u')).toEqual({ ok: true });
      expect(prisma.compraEstoque.delete).toHaveBeenCalledWith({ where: { id: 'c' } });
      expect(prisma.produto.update.mock.calls[0][0].data).toEqual({ custo: 18 });
    });

    it('refaz o rateio da compra que sobrou; lote sem entrada', async () => {
      prisma.loteProduto.findUnique.mockResolvedValue(lote());
      prisma.itemCompraEstoque.count.mockResolvedValue(1);
      const atualizar = vi.spyOn(service, 'atualizarCompra').mockResolvedValue({} as any);
      await service.excluirLote('l', 'u');
      expect(atualizar).toHaveBeenCalledWith('c', {}, 'u');

      prisma.loteProduto.findUnique.mockResolvedValue(lote({ movimentacoesLote: [] }));
      await service.excluirLote('l', 'u');
      expect(atualizar).toHaveBeenCalledTimes(1);
      expect(prisma.logAuditoria.create.mock.calls[1][0].data.detalhes.compraId).toBeNull();
    });
  });

  describe('baixa e devolução nos lotes', () => {
    const lote = {
      id: 'l',
      produtoId: 'a',
      numero: '7',
      dataEntrada: DIA,
      ativo: true,
      quantidadeDisponivel: 5,
      produto: { nome: 'Morango' },
    };

    it('baixa do lote escolhido, registrando o pedido', async () => {
      expect(
        await service.baixarLoteEmTx(
          prisma as any,
          { loteId: 'l', produtoId: 'a', quantidade: 0 } as any,
        ),
      ).toBeNull();
      await expect(
        service.baixarLoteEmTx(
          prisma as any,
          { loteId: 'l', produtoId: 'a', quantidade: 1 } as any,
        ),
      ).rejects.toThrow('não pertence ao produto');
      prisma.loteProduto.findUnique.mockResolvedValue({ ...lote, produtoId: 'b' });
      await expect(
        service.baixarLoteEmTx(
          prisma as any,
          { loteId: 'l', produtoId: 'a', quantidade: 1 } as any,
        ),
      ).rejects.toThrow('não pertence');
      prisma.loteProduto.findUnique.mockResolvedValue({ ...lote, quantidadeDisponivel: null });
      await expect(
        service.baixarLoteEmTx(
          prisma as any,
          { loteId: 'l', produtoId: 'a', quantidade: 1 } as any,
        ),
      ).rejects.toThrow('Saldo insuficiente no 18/11 - lote 7 de Morango: disponível 0 cx');
      prisma.loteProduto.findUnique.mockResolvedValue({ ...lote, ativo: false });
      await expect(
        service.baixarLoteEmTx(
          prisma as any,
          { loteId: 'l', produtoId: 'a', quantidade: 1 } as any,
        ),
      ).rejects.toThrow('Saldo insuficiente');

      prisma.loteProduto.findUnique.mockResolvedValue(lote);
      expect(
        await service.baixarLoteEmTx(prisma as any, {
          loteId: 'l',
          produtoId: 'a',
          quantidade: 2,
          movimentacaoId: 'm',
          origem: 'o',
        }),
      ).toEqual({ loteId: 'l', quantidade: 2, saldoAntes: 5, saldoDepois: 3 });
      expect(prisma.itemPedidoLote.findFirst).not.toHaveBeenCalled();

      await service.baixarLoteEmTx(prisma as any, {
        loteId: 'l',
        produtoId: 'a',
        quantidade: 2,
        movimentacaoId: 'm',
        origem: 'o',
        pedidoId: 'p',
      });
      expect(prisma.itemPedidoLote.create.mock.calls[0][0].data).toMatchObject({
        quantidade: 2,
        valorUnitario: 0,
        valorTotal: 0,
      });
      prisma.itemPedidoLote.findFirst.mockResolvedValue({ id: 'ipl', quantidade: 2 });
      await service.baixarLoteEmTx(prisma as any, {
        loteId: 'l',
        produtoId: 'a',
        quantidade: 1,
        movimentacaoId: 'm',
        origem: 'o',
        pedidoId: 'p',
        valorUnitario: 30,
      });
      expect(prisma.itemPedidoLote.update.mock.calls[0][0].data).toEqual({
        quantidade: 3,
        valorUnitario: 30,
        valorTotal: 90,
      });
    });

    it('devolve ao lote e ajusta o que ficou com o cliente', async () => {
      expect(
        await service.devolverAoLoteEmTx(prisma as any, { loteId: 'l', quantidade: 0 } as any),
      ).toBeNull();
      await expect(
        service.devolverAoLoteEmTx(prisma as any, { loteId: 'l', quantidade: 1 } as any),
      ).rejects.toThrow('Lote não encontrado');
      prisma.loteProduto.findUnique.mockResolvedValue({ ...lote, quantidadeDisponivel: null });
      expect(
        (await service.devolverAoLoteEmTx(prisma as any, {
          loteId: 'l',
          quantidade: 2,
          movimentacaoId: 'm',
          origem: 'o',
        }))!.saldoDepois,
      ).toBe(2);

      await service.devolverAoLoteEmTx(prisma as any, {
        loteId: 'l',
        quantidade: 2,
        movimentacaoId: 'm',
        origem: 'o',
        pedidoId: 'p',
      });
      prisma.itemPedidoLote.findFirst.mockResolvedValueOnce({
        id: 'a',
        quantidade: 2,
        valorUnitario: 10,
      });
      await service.devolverAoLoteEmTx(prisma as any, {
        loteId: 'l',
        quantidade: 2,
        movimentacaoId: 'm',
        origem: 'o',
        pedidoId: 'p',
      });
      expect(prisma.itemPedidoLote.delete).toHaveBeenCalledWith({ where: { id: 'a' } });
      prisma.itemPedidoLote.findFirst.mockResolvedValueOnce({
        id: 'b',
        quantidade: 5,
        valorUnitario: 10,
      });
      await service.devolverAoLoteEmTx(prisma as any, {
        loteId: 'l',
        quantidade: 2,
        movimentacaoId: 'm',
        origem: 'o',
        pedidoId: 'p',
      });
      expect(prisma.itemPedidoLote.update.mock.calls[0][0].data).toEqual({
        quantidade: 3,
        valorTotal: 30,
      });
    });

    it('devolve do pedido começando pelo lote preferido', async () => {
      prisma.itemPedidoLote.findMany.mockResolvedValue([
        { id: '1', loteId: 'x', quantidade: 2 },
        { id: '2', loteId: 'pref', quantidade: 1 },
        { id: '3', loteId: 'y', quantidade: 0 },
        { id: '4', loteId: 'z', quantidade: 5 },
      ]);
      const devolver = vi.spyOn(service, 'devolverAoLoteEmTx').mockResolvedValue(null);
      const resto = await service.devolverDoPedidoEmTx(prisma as any, {
        pedidoId: 'p',
        produtoId: 'a',
        quantidade: 3,
        movimentacaoId: 'm',
        origem: 'o',
        loteIdPreferido: 'pref',
      });
      expect(devolver.mock.calls.map((c) => [c[1].loteId, c[1].quantidade])).toEqual([
        ['pref', 1],
        ['x', 2],
      ]);
      expect(resto).toBe(0);

      prisma.itemPedidoLote.findMany.mockResolvedValue([{ id: '3', loteId: 'y', quantidade: 0 }]);
      expect(
        await service.devolverDoPedidoEmTx(prisma as any, {
          pedidoId: 'p',
          produtoId: 'a',
          quantidade: 4,
          movimentacaoId: 'm',
          origem: 'o',
        }),
      ).toBe(4);
      expect(
        await service.devolverDoPedidoEmTx(
          prisma as any,
          { pedidoId: 'p', produtoId: 'a', quantidade: undefined as any } as any,
        ),
      ).toBe(0);
    });

    it('retira do pedido sem voltar ao estoque', async () => {
      prisma.itemPedidoLote.findMany.mockResolvedValue([
        { id: '1', loteId: 'x', quantidade: 3, valorUnitario: 10 },
        { id: '2', loteId: 'pref', quantidade: 1, valorUnitario: 10 },
        { id: '3', loteId: 'y', quantidade: 0, valorUnitario: 10 },
        { id: '4', loteId: 'z', quantidade: 5, valorUnitario: 10 },
      ]);
      await service.retirarDoPedidoEmTx(prisma as any, {
        pedidoId: 'p',
        produtoId: 'a',
        quantidade: 2,
        loteIdPreferido: 'pref',
      });
      expect(prisma.itemPedidoLote.delete).toHaveBeenCalledWith({ where: { id: '2' } });
      expect(prisma.itemPedidoLote.update.mock.calls[0][0]).toEqual({
        where: { id: '1' },
        data: { quantidade: 2, valorTotal: 20 },
      });

      prisma.itemPedidoLote.findMany.mockResolvedValue([
        { id: '3', loteId: 'y', quantidade: 0, valorUnitario: 1 },
      ]);
      await service.retirarDoPedidoEmTx(prisma as any, {
        pedidoId: 'p',
        produtoId: 'a',
        quantidade: 1,
      });
      await service.retirarDoPedidoEmTx(prisma as any, {
        pedidoId: 'p',
        produtoId: 'a',
        quantidade: undefined as any,
      });
    });
  });

  it('rastreio do pedido e extrato do lote', async () => {
    const mov = (extra: object = {}) => ({
      id: 'm',
      data: DIA,
      origem: 'Pedido 1',
      quantidade: 2,
      saldoAntes: 5,
      saldoDepois: 3,
      lote: { id: 'l', numero: '7', dataEntrada: DIA, produto: { id: 'a', nome: 'Morango' } },
      ...extra,
    });
    prisma.movimentacaoEstoqueLote.findMany.mockResolvedValue([
      mov(),
      mov({ saldoAntes: 3, saldoDepois: 5 }),
      mov({ saldoAntes: null, saldoDepois: null, lote: undefined }),
    ]);
    prisma.itemPedidoLote.findMany.mockResolvedValue([
      {
        produtoId: 'a',
        produto: { nome: 'Morango', codigoInterno: 'M' },
        loteId: 'l',
        lote: { numero: '7', dataEntrada: DIA },
        quantidade: '2',
        valorUnitario: '30',
        valorTotal: '60',
      },
    ]);
    const r = await service.lotesUtilizadosNoPedido('p');
    expect(r.resumo[0]).toMatchObject({ quantidade: 2, valorTotal: 60, loteNumero: '7' });
    expect(r.movimentos.map((m) => m.tipo)).toEqual(['SAIDA', 'ENTRADA', 'SAIDA']);
    expect(r.movimentos[2]).toMatchObject({ saldoAntes: null });
    expect((r.movimentos[2] as any).loteId).toBeUndefined();

    await expect(service.historicoLote('l')).rejects.toThrow('Lote não encontrado');
    prisma.loteProduto.findUnique.mockResolvedValue({
      id: 'l',
      numero: '7',
      dataEntrada: DIA,
      produto: { id: 'a' },
      quantidadeInicial: 10,
      quantidadeDisponivel: '3',
    });
    prisma.movimentacaoEstoqueLote.findMany.mockResolvedValue([
      mov({
        movimentacao: {
          motivoAjuste: null,
          usuario: { nome: 'Duda' },
          pedido: { id: 'p', numero: 1, cliente: { razaoSocialOuNome: 'M' } },
        },
      }),
      mov({ movimentacao: { motivoAjuste: 'quebra', usuario: null, pedido: null } }),
      mov({ movimentacao: { pedido: { id: 'q', numero: 2, cliente: null } } }),
    ]);
    const h = await service.historicoLote('l');
    expect(h.lote.quantidadeDisponivel).toBe(3);
    expect(h.movimentos[0]).toMatchObject({ numeroPedido: 1, cliente: 'M', usuario: 'Duda' });
    expect(h.movimentos[1]).toMatchObject({
      pedidoId: null,
      motivoAjuste: 'quebra',
      usuario: null,
    });
    expect(h.movimentos[2].cliente).toBeNull();
  });

  it('saída de pedido e ajuste manual num lote', async () => {
    await service.registrarSaida({
      produtoId: 'a',
      quantidade: 3,
      pedidoId: 'p',
      numeroPedido: 9,
      usuarioId: 'u',
    });
    expect(prisma.movimentacaoEstoque.create.mock.calls[0][0].data).toMatchObject({
      quantidade: -3,
      origem: 'Pedido 9',
    });

    const ajuste = (quantidade: number, loteId?: string) =>
      service.registrarAjuste({
        produtoId: 'a',
        quantidade,
        motivo: 'quebra',
        usuarioId: 'u',
        loteId,
      });
    await expect(ajuste(0, 'l')).rejects.toThrow('diferente de zero');
    await expect(ajuste(1)).rejects.toThrow('Selecione o lote');

    prisma.movimentacaoEstoque.create.mockResolvedValue({ id: 'mov' });
    await expect(ajuste(2, 'l')).rejects.toThrow('não pertence ao produto');
    prisma.loteProduto.findUnique.mockResolvedValue({ id: 'l', produtoId: 'b' });
    await expect(ajuste(2, 'l')).rejects.toThrow('não pertence ao produto');

    const devolver = vi.spyOn(service, 'devolverAoLoteEmTx').mockResolvedValue(null);
    const baixar = vi.spyOn(service, 'baixarLoteEmTx').mockResolvedValue(null);
    prisma.loteProduto.findUnique.mockResolvedValue({ id: 'l', produtoId: 'a' });
    expect(await ajuste(2, 'l')).toEqual({ id: 'mov' });
    expect(devolver.mock.calls[0][1]).toMatchObject({
      quantidade: 2,
      origem: 'Ajuste manual - quebra',
    });
    await ajuste(-3, 'l');
    expect(baixar.mock.calls[0][1]).toMatchObject({ quantidade: 3 });
  });

  it('saldos e histórico', async () => {
    prisma.movimentacaoEstoque.aggregate.mockResolvedValueOnce({ _sum: { quantidade: null } });
    expect(await service.saldoAtual('a')).toBe(0);
    prisma.movimentacaoEstoque.aggregate.mockResolvedValueOnce({ _sum: { quantidade: 4 } });
    expect(await service.saldoAtual('a')).toBe(4);

    prisma.produto.findMany.mockResolvedValue([
      { id: 'a', estoqueMinimo: 10, custo: 5 },
      { id: 'b', estoqueMinimo: null, custo: 5 },
      { id: 'c', estoqueMinimo: null, custo: null },
    ]);
    prisma.movimentacaoEstoque.aggregate.mockResolvedValue({ _sum: { quantidade: 3 } });
    prisma.movimentacaoEstoque.findFirst
      .mockResolvedValueOnce({ custoUnitario: '21' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ custoUnitario: null });
    const s = await service.saldosTodos();
    expect(s.map((p) => [p.abaixoMinimo, p.custoCaixa])).toEqual([
      [true, 21],
      [false, 5],
      [false, null],
    ]);

    await service.historico('a');
    expect(prisma.movimentacaoEstoque.findMany.mock.calls[0][0].where).toEqual({ produtoId: 'a' });
  });
});
