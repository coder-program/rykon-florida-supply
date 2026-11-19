import { beforeEach, describe, expect, it } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { FornecedoresService } from './fornecedores.service';

describe('FornecedoresService', () => {
  let prisma: PrismaMock;
  let service: FornecedoresService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new FornecedoresService(prisma as any);
  });

  it('lista ativos ou todos', async () => {
    await service.findAll();
    expect(prisma.fornecedor.findMany.mock.calls[0][0].where).toEqual({ ativo: true });
    await service.findAll(true);
    expect(prisma.fornecedor.findMany.mock.calls[1][0].where).toEqual({});
  });

  it('findOne inexistente', async () => {
    await expect(service.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cria com campos vazios virando null', async () => {
    prisma.fornecedor.findFirst.mockResolvedValue(null);
    await service.create({ nome: ' Ceasa ', documento: '', telefone: ' 11 ' });
    expect(prisma.fornecedor.create.mock.calls[0][0].data).toEqual({
      nome: 'Ceasa',
      documento: null,
      telefone: '11',
      observacao: undefined,
    });
  });

  it('não cria nome repetido ativo', async () => {
    prisma.fornecedor.findFirst.mockResolvedValue({ id: '1', nome: 'Ceasa', ativo: true });
    await expect(service.create({ nome: 'ceasa' })).rejects.toThrow('Já existe o fornecedor Ceasa');
  });

  it('nome repetido inativo é reativado', async () => {
    prisma.fornecedor.findFirst.mockResolvedValue({ id: '1', nome: 'Ceasa', ativo: false });
    await service.create({ nome: 'Ceasa', observacao: 'obs' });
    expect(prisma.fornecedor.update.mock.calls[0][0]).toMatchObject({
      where: { id: '1' },
      data: { ativo: true, documento: null, telefone: null, observacao: 'obs' },
    });
  });

  it('atualiza conferindo nome repetido', async () => {
    prisma.fornecedor.findUnique.mockResolvedValue({ id: '1' });
    prisma.fornecedor.findFirst.mockResolvedValue(null);
    await service.update('1', { nome: 'Novo' });
    expect(prisma.fornecedor.findFirst.mock.calls[0][0].where.id).toEqual({ not: '1' });
    await service.update('1', {});
    expect(prisma.fornecedor.update).toHaveBeenCalledTimes(2);

    prisma.fornecedor.findFirst.mockResolvedValue({ id: '2', nome: 'Novo', ativo: false });
    await expect(service.update('1', { nome: 'Novo' })).rejects.toThrow('(inativo;');
    prisma.fornecedor.findFirst.mockResolvedValue({ id: '2', nome: 'Novo', ativo: true });
    await expect(service.update('1', { nome: 'Novo' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remove inativa e reativar ativa', async () => {
    prisma.fornecedor.findUnique.mockResolvedValue({ id: '1' });
    await service.remove('1');
    await service.reativar('1');
    expect(prisma.fornecedor.update.mock.calls.map((c: any) => c[0].data.ativo)).toEqual([
      false,
      true,
    ]);
  });
});
