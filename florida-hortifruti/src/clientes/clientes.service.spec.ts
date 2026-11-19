import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { ClientesService } from './clientes.service';

const erroUnico = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: '5',
    meta: { target },
  });

const ADMIN = { id: 'adm', papel: 'ADMINISTRADOR' } as const;
const REV = { id: 'rev', papel: 'REVENDEDOR' } as const;

describe('ClientesService', () => {
  let prisma: PrismaMock;
  let enderecos: Record<string, ReturnType<typeof vi.fn>>;
  let service: ClientesService;
  const ENV = { ...process.env };

  beforeEach(() => {
    prisma = criarPrismaMock();
    enderecos = { create: vi.fn(), findByEntidade: vi.fn(async () => []) };
    service = new ClientesService(prisma as any, enderecos as any);
    prisma.cliente.create.mockResolvedValue({ id: 'c' });
    prisma.cliente.update.mockResolvedValue({ id: 'c' });
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c', cnpjCpf: '123', revendedorId: null });
  });
  afterEach(() => {
    process.env = { ...ENV };
  });

  it('cria: placeholder sem documento, dono revendedor e endereço', async () => {
    await service.create({ razaoSocialOuNome: 'A' } as any, REV as any);
    const data = prisma.cliente.create.mock.calls[0][0].data;
    expect(data.cnpjCpf).toMatch(/^SEM-DOC-/);
    expect(data.revendedorId).toBe('rev');

    await service.create({ cnpjCpf: '1', endereco: { cidadeId: 'x' } } as any);
    expect(prisma.cliente.create.mock.calls[1][0].data).toMatchObject({
      cnpjCpf: '1',
      revendedorId: null,
    });
    expect(enderecos.create.mock.calls[0][2]).toMatchObject({ principal: true });

    await service.create(
      { endereco: { endereco: { logradouro: 'R', principal: false } } } as any,
      ADMIN as any,
    );
    expect(enderecos.create.mock.calls[1][2]).toEqual({ logradouro: 'R', principal: false });

    await service.create({ endereco: { numero: '1' } } as any);
    await service.create({ endereco: { endereco: { numero: '1' } } } as any);
    expect(enderecos.create).toHaveBeenCalledTimes(2);
  });

  it('documento repetido vira mensagem clara', async () => {
    prisma.cliente.create.mockRejectedValueOnce(erroUnico(['cnpjCpf']));
    await expect(service.create({} as any)).rejects.toThrow('Já existe cliente');
    prisma.cliente.create.mockRejectedValueOnce(erroUnico('clientes_cnpjCpf_key'));
    await expect(service.create({} as any)).rejects.toThrow('Já existe cliente');
    prisma.cliente.create.mockRejectedValueOnce(erroUnico(undefined));
    await expect(service.create({} as any)).rejects.toThrow('dup');
    prisma.cliente.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.create({} as any)).rejects.toThrow('x');
    prisma.cliente.create.mockRejectedValueOnce(new Error('y'));
    await expect(service.create({} as any)).rejects.toThrow('y');
  });

  it('lista conforme o dono e esconde o placeholder', async () => {
    prisma.cliente.findMany.mockResolvedValue([
      { id: 'a', cnpjCpf: 'SEM-DOC-1', revendedorId: null },
      { id: 'b', cnpjCpf: '123', revendedorId: 'rev' },
    ]);
    const r = await service.findAll(false, ADMIN as any);
    expect(prisma.cliente.findMany.mock.calls[0][0].where).toEqual({
      revendedorId: null,
      ativo: true,
    });
    expect(r[0].cnpjCpf).toBeNull();

    const rev = await service.findAll(true, REV as any);
    expect(prisma.cliente.findMany.mock.calls[1][0].where).toEqual({
      OR: [{ revendedorId: 'rev' }, { revendedorId: null }],
    });
    // Cliente da Flórida chega sem documento para o revendedor; o dele, completo
    expect(rev[0].cnpjCpf).toBeUndefined();
    expect(rev[1].cnpjCpf).toBe('123');

    await service.findAll();
    expect(prisma.cliente.findMany.mock.calls[2][0].where).toEqual({ ativo: true });
  });

  it('busca: revendedor só pesquisa documento/telefone dos clientes dele', async () => {
    prisma.cliente.findMany.mockResolvedValue([{ id: 'a', cnpjCpf: '1', revendedorId: null }]);
    await service.search('11', REV as any);
    const where = prisma.cliente.findMany.mock.calls[0][0].where;
    expect(where.OR[2]).toMatchObject({ revendedorId: 'rev' });
    await service.search('11');
    expect(prisma.cliente.findMany.mock.calls[1][0].where.OR[2].revendedorId).toBeUndefined();
  });

  it('garante acesso', async () => {
    prisma.cliente.findUnique.mockResolvedValueOnce(null);
    await expect(service.garantirAcesso('c', ADMIN as any)).rejects.toThrow(
      'Cliente não encontrado',
    );

    const caso = async (revendedorId: string | null, usuario: any, opts?: object) => {
      prisma.cliente.findUnique.mockResolvedValueOnce({ revendedorId });
      return service.garantirAcesso('c', usuario, opts).then(
        () => true,
        () => false,
      );
    };
    expect(await caso(null, ADMIN)).toBe(true);
    expect(await caso('rev', ADMIN)).toBe(false);
    expect(await caso('rev', REV)).toBe(true);
    expect(await caso(null, REV)).toBe(false);
    expect(await caso(null, REV, { leitura: true })).toBe(true);
    expect(await caso('outro', REV, { leitura: true })).toBe(false);
  });

  it('findOne e por usuário', async () => {
    prisma.cliente.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('c')).rejects.toThrow('Cliente não encontrado');
    prisma.cliente.findUnique.mockResolvedValueOnce(null);
    await expect(service.findByUsuarioId('u')).rejects.toThrow('não vinculado');
    expect((await service.findByUsuarioId('u')).id).toBe('c');
  });

  it('atualiza documento apagado com placeholder', async () => {
    await service.update('c', { cnpjCpf: '' } as any);
    expect(prisma.cliente.update.mock.calls[0][0].data.cnpjCpf).toMatch(/^SEM-DOC-/);

    prisma.cliente.findUnique.mockResolvedValue({ id: 'c', cnpjCpf: 'SEM-DOC-1' });
    await service.update('c', { cnpjCpf: '', endereco: { cidadeId: 'x' } } as any);
    expect(prisma.cliente.update.mock.calls[1][0].data).toEqual({});
    expect(enderecos.create).toHaveBeenCalled();

    await service.update('c', { nomeFantasia: 'N' } as any);
    expect(prisma.cliente.update.mock.calls[2][0].data).toEqual({ nomeFantasia: 'N' });

    prisma.cliente.update.mockRejectedValueOnce(erroUnico(['cnpjCpf']));
    await expect(service.update('c', { cnpjCpf: '9' } as any)).rejects.toThrow('Já existe cliente');
    prisma.cliente.update.mockRejectedValueOnce(new Error('z'));
    await expect(service.update('c', {} as any)).rejects.toThrow('z');
  });

  it('contatos', async () => {
    await service.listarContatos('c');
    await service.registrarContato('c', { tipo: 'LIGACAO', resumo: ' ligou ' } as any, 'u');
    expect(prisma.contatoCliente.create.mock.calls[0][0].data).toMatchObject({
      resumo: 'ligou',
      proximoContato: null,
    });
    expect(prisma.contatoCliente.create.mock.calls[0][0].data.data).toBeUndefined();
    await service.registrarContato(
      'c',
      { tipo: 'VISITA', resumo: 'x', data: '2026-01-02', proximoContato: '2026-01-10' } as any,
      'u',
    );
    const d = prisma.contatoCliente.create.mock.calls[1][0].data;
    expect(d.data).toBeInstanceOf(Date);
    expect(d.proximoContato.toISOString()).toBe('2026-01-10T15:00:00.000Z');
    await service.ultimosContatos();
    expect(prisma.contatoCliente.findMany).toHaveBeenCalledTimes(2);
  });

  it('inativa e reativa', async () => {
    await service.remove('c');
    await service.reativar('c');
    expect(prisma.cliente.update.mock.calls.map((c: any) => c[0].data.ativo)).toEqual([
      false,
      true,
    ]);
  });

  it('ativar acesso gera convite', async () => {
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c', cnpjCpf: '1', email: null });
    await expect(service.ativarAcesso('c')).rejects.toThrow('Informe o e-mail');

    prisma.cliente.findUnique.mockResolvedValue({
      id: 'c',
      cnpjCpf: '1',
      email: 'a@a',
      statusConvite: 'ATIVO',
      usuarioId: 'u',
    });
    await expect(service.ativarAcesso('c', ' A@A ')).rejects.toThrow('já possui acesso');
    expect(prisma.cliente.update).not.toHaveBeenCalled();

    delete process.env.PWA_CLIENTE_PUBLIC_URL;
    delete process.env.PWA_PUBLIC_URL;
    prisma.cliente.findUnique.mockResolvedValue({ id: 'c', cnpjCpf: '1', email: 'a@a' });
    const r = await service.ativarAcesso('c', 'novo@a');
    expect(prisma.cliente.update.mock.calls[0][0].data).toEqual({ email: 'novo@a' });
    expect(r.linkConvite).toMatch(/^http:\/\/localhost:5201\/definir-senha\?token=/);

    process.env.PWA_PUBLIC_URL = 'https://app.x/';
    expect((await service.ativarAcesso('c')).linkConvite).toMatch(
      /^https:\/\/app\.x\/definir-senha/,
    );
    process.env.PWA_CLIENTE_PUBLIC_URL = 'https://cliente.x';
    expect((await service.ativarAcesso('c')).linkConvite).toMatch(/^https:\/\/cliente\.x\//);
  });
});
