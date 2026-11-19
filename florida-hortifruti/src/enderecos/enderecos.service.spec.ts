import { beforeEach, describe, expect, it } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { EnderecosService } from './enderecos.service';

describe('EnderecosService', () => {
  let prisma: PrismaMock;
  let service: EnderecosService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new EnderecosService(prisma as any);
  });

  it('recusa tipos inválidos', async () => {
    await expect(service.create('planeta', 'e', { cidadeId: 'c' } as any)).rejects.toThrow(
      'Tipo de entidade',
    );
    prisma.cidade.findUnique.mockResolvedValue({ id: 'c' });
    await expect(
      service.create('cliente', 'e', { cidadeId: 'c', tipo: 'lua' } as any),
    ).rejects.toThrow('Tipo de endereço inválido');
  });

  it('cria: cidade obrigatória, principal desmarca os outros, padrões', async () => {
    await expect(service.create('CLIENTE', 'e', { cidadeId: 'c' } as any)).rejects.toThrow(
      'Cidade não encontrada',
    );
    prisma.cidade.findUnique.mockResolvedValue({ id: 'c' });
    await service.create('cliente', 'e', { cidadeId: 'c' } as any);
    expect(prisma.endereco.updateMany).not.toHaveBeenCalled();
    expect(prisma.endereco.create.mock.calls[0][0].data).toMatchObject({
      entidadeTipo: 'CLIENTE',
      tipo: 'PRINCIPAL',
      principal: true,
      cep: null,
      logradouro: '',
    });
    await service.create('cliente', 'e', {
      cidadeId: 'c',
      principal: true,
      tipo: 'entrega',
      logradouro: 'Rua',
      cep: '1',
      numero: '2',
      complemento: 'a',
      bairro: 'b',
      pontoReferencia: 'p',
    } as any);
    expect(prisma.endereco.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.endereco.create.mock.calls[1][0].data.tipo).toBe('ENTREGA');
  });

  it('busca por entidade e principal', async () => {
    await service.findByEntidade('cliente', 'e');
    expect(await service.findPrincipal('cliente', 'e')).toBeNull();
    prisma.endereco.findFirst.mockResolvedValue({ id: 'x' });
    expect(await service.findPrincipal('cliente', 'e')).toEqual({ id: 'x' });
  });

  it('atualiza só o que veio', async () => {
    await expect(service.update('x', {})).rejects.toThrow('Endereço não encontrado');
    prisma.endereco.findUnique.mockResolvedValue({
      id: 'x',
      entidadeTipo: 'CLIENTE',
      entidadeId: 'e',
    });
    await expect(service.update('x', { cidadeId: 'c' })).rejects.toThrow('Cidade não encontrada');
    await service.update('x', {});
    expect(prisma.endereco.update.mock.calls[0][0].data).toEqual({});
    prisma.cidade.findUnique.mockResolvedValue({ id: 'c' });
    await service.update('x', {
      cep: '1',
      logradouro: 'R',
      numero: '1',
      complemento: 'c',
      bairro: 'b',
      cidadeId: 'c',
      pontoReferencia: 'p',
      principal: true,
      tipo: 'entrega',
    } as any);
    expect(prisma.endereco.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.endereco.update.mock.calls[1][0].data).toMatchObject({
      tipo: 'ENTREGA',
      principal: true,
    });
    await service.update('x', {
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      pontoReferencia: null,
      principal: false,
    } as any);
    expect(prisma.endereco.update.mock.calls[2][0].data).toMatchObject({
      logradouro: '',
      cep: null,
    });
  });

  it('remove', async () => {
    await expect(service.remove('x')).rejects.toThrow('Endereço não encontrado');
    prisma.endereco.findUnique.mockResolvedValue({ id: 'x' });
    expect(await service.remove('x')).toEqual({ ok: true });
  });
});
