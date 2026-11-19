import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { ProdutosService } from './produtos.service';

describe('ProdutosService', () => {
  let prisma: PrismaMock;
  let service: ProdutosService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new ProdutosService(prisma as any);
  });

  it('disponibilidade pelo saldo e limite', () => {
    expect(ProdutosService.disponibilidade(0, 5)).toBe('INDISPONIVEL');
    expect(ProdutosService.disponibilidade(3, 5)).toBe('POUCA_QUANTIDADE');
    expect(ProdutosService.disponibilidade(3, null, 4)).toBe('POUCA_QUANTIDADE');
    expect(ProdutosService.disponibilidade(10, 5)).toBe('DISPONIVEL');
    expect(ProdutosService.disponibilidade(10)).toBe('DISPONIVEL');
  });

  it('cria', async () => {
    await service.create({ nome: 'Morango' } as any);
    expect(prisma.produto.create.mock.calls[0][0].data).toEqual({ nome: 'Morango' });
  });

  it('lista com saldo de estoque', async () => {
    prisma.produto.findMany.mockResolvedValue([]);
    expect(await service.findAll()).toEqual([]);
    expect(prisma.movimentacaoEstoque.groupBy).not.toHaveBeenCalled();

    prisma.produto.findMany.mockResolvedValue([
      { id: 'a', limiteEstoqueBaixo: 5, estoqueMinimo: null },
      { id: 'b', limiteEstoqueBaixo: null, estoqueMinimo: 2 },
      { id: 'c', limiteEstoqueBaixo: null, estoqueMinimo: null },
    ]);
    prisma.movimentacaoEstoque.groupBy.mockResolvedValue([
      { produtoId: 'a', _sum: { quantidade: 4 } },
      { produtoId: 'b', _sum: { quantidade: null } },
    ]);
    const r = await service.findAll(true);
    expect(prisma.produto.findMany.mock.calls[1][0].where).toEqual({});
    expect(r.map((p) => [p.estoqueAtual, p.disponibilidade])).toEqual([
      [4, 'POUCA_QUANTIDADE'],
      [0, 'INDISPONIVEL'],
      [0, 'INDISPONIVEL'],
    ]);
  });

  it('atualiza: código repetido e histórico de preço', async () => {
    await expect(service.update('p', {}, 'u')).rejects.toThrow('Produto não encontrado');
    prisma.produto.findUnique.mockImplementation(async ({ where }: any) =>
      where.id ? { id: 'p', codigoInterno: 'A1', precoSugerido: 10 } : { id: 'outro' },
    );
    await expect(service.update('p', { codigoInterno: 'B2' }, 'u')).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.produto.findUnique.mockImplementation(async ({ where }: any) =>
      where.id ? { id: 'p', codigoInterno: 'A1', precoSugerido: 10 } : null,
    );
    prisma.produto.update.mockReturnValue('atualizado');
    expect(await service.update('p', { codigoInterno: 'B2' }, 'u')).toBe('atualizado');
    expect(prisma.historicoPreco.create).not.toHaveBeenCalled();
    await service.update('p', { codigoInterno: 'A1', precoSugerido: 10 }, 'u');
    expect(prisma.historicoPreco.create).not.toHaveBeenCalled();
    await service.update('p', { precoSugerido: 12 }, 'u');
    expect(prisma.historicoPreco.create.mock.calls[0][0].data).toMatchObject({
      valorAnterior: 10,
      valorNovo: 12,
    });
  });

  it('inativa, reativa e histórico', async () => {
    prisma.produto.findUnique.mockResolvedValue({ id: 'p' });
    await service.remove('p');
    await service.reativar('p');
    expect(prisma.produto.update.mock.calls.map((c: any) => c[0].data.ativo)).toEqual([
      false,
      true,
    ]);
    await service.historicoPrecos('p');
    expect(prisma.historicoPreco.findMany.mock.calls[0][0].where).toEqual({ produtoId: 'p' });
  });

  it('categorias', async () => {
    await service.listarCategorias();
    prisma.categoria.findUnique.mockResolvedValue({ id: 'c' });
    await expect(service.criarCategoria(' Frutas ')).rejects.toThrow('Já existe uma categoria');
    await service.atualizarCategoria('c', ' Legumes ');
    expect(prisma.categoria.update.mock.calls[0][0].data).toEqual({ nome: 'Legumes' });

    prisma.categoria.findUnique.mockResolvedValue(null);
    await service.criarCategoria(' Frutas ');
    expect(prisma.categoria.create.mock.calls[0][0].data).toEqual({ nome: 'Frutas' });
    await expect(service.atualizarCategoria('c', 'x')).rejects.toThrow('Categoria não encontrada');
  });

  it('preço por cliente guarda o anterior no histórico', async () => {
    prisma.produto.findUnique.mockResolvedValue({ id: 'p', precoSugerido: 10 });
    prisma.precoCliente.upsert.mockResolvedValue({ precoUnitario: 9 });
    expect(await service.definirPrecoCliente('c', 'p', 9, 'u')).toEqual({ precoUnitario: 9 });
    expect(prisma.historicoPreco.create.mock.calls[0][0].data.valorAnterior).toBe(10);

    prisma.precoCliente.findUnique.mockResolvedValue({ precoUnitario: 9 });
    await service.definirPrecoCliente('c', 'p', 8, 'u');
    expect(prisma.historicoPreco.create.mock.calls[1][0].data.valorAnterior).toBe(9);

    await service.listarPrecosCliente('c');
    expect(prisma.precoCliente.findMany).toHaveBeenCalled();
  });
});
