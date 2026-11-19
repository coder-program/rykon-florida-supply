import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { UsuariosService } from './usuarios.service';

const ENDERECO = { cep: '1', logradouro: 'R', numero: '2', bairro: 'B', cidadeId: 'c' };
const PERFIL = { cpf: '1', dataNascimento: '1990-01-01', telefone: '11', whatsapp: '11' };

const erroCpf = (target: unknown) =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: '5',
    meta: { target },
  });

describe('UsuariosService', () => {
  let prisma: PrismaMock;
  let enderecos: Record<string, ReturnType<typeof vi.fn>>;
  let service: UsuariosService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    enderecos = {
      findPrincipal: vi.fn(async () => null),
      update: vi.fn(),
      create: vi.fn(async () => ({ id: 'end' })),
      findByEntidade: vi.fn(async () => []),
    };
    service = new UsuariosService(prisma as any, enderecos as any);
    prisma.usuario.create.mockResolvedValue({ id: 'u' });
    prisma.usuario.update.mockResolvedValue({ id: 'u' });
    prisma.usuario.findUnique.mockImplementation(async ({ where }: any) =>
      where.email ? null : { id: 'u', papel: 'ADMINISTRADOR' },
    );
  });

  it('não cria cliente nem e-mail repetido', async () => {
    await expect(service.create({ papel: 'CLIENTE' } as any)).rejects.toThrow(
      'convite em Clientes',
    );
    prisma.usuario.findUnique.mockResolvedValueOnce({ id: 'x' });
    await expect(
      service.create({ papel: 'ADMINISTRADOR', email: 'a', senha: 's' } as any),
    ).rejects.toThrow('E-mail já cadastrado');
  });

  it('vendedor e motorista precisam do cadastro completo', async () => {
    const base = { papel: 'VENDEDOR', email: 'a', senha: 's' };
    const casos: [object, object | undefined, string][] = [
      [{}, undefined, 'CPF'],
      [{ cpf: '1' }, undefined, 'data de nascimento'],
      [{ cpf: '1', dataNascimento: 'x' }, undefined, 'telefone'],
      [{ cpf: '1', dataNascimento: 'x', telefone: '1' }, undefined, 'WhatsApp'],
      [PERFIL, undefined, 'endereço principal completo'],
      [PERFIL, { ...ENDERECO, bairro: ' ' }, 'endereço principal completo'],
    ];
    for (const [perfil, endereco, msg] of casos) {
      await expect(service.create({ ...base, ...perfil, endereco } as any)).rejects.toThrow(msg);
    }
  });

  it('cria com endereço novo ou atualiza o principal existente', async () => {
    await service.create({
      papel: 'MOTORISTA',
      email: 'a',
      senha: 's',
      ...PERFIL,
      endereco: ENDERECO,
    } as any);
    expect(prisma.usuario.create.mock.calls[0][0].data).toMatchObject({
      cpf: '1',
      senhaHash: expect.any(String),
    });
    expect(prisma.usuario.create.mock.calls[0][0].data.senha).toBeUndefined();
    expect(enderecos.create.mock.calls[0][2]).toMatchObject({ principal: true });
    expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ enderecoPrincipalId: 'end' });

    enderecos.findPrincipal.mockResolvedValue({ id: 'velho' });
    await service.create({
      papel: 'ADMINISTRADOR',
      email: 'a',
      senha: 's',
      endereco: { endereco: { logradouro: 'R', principal: false } },
    } as any);
    expect(enderecos.update.mock.calls[0]).toEqual([
      'velho',
      { logradouro: 'R', principal: false },
    ]);
    expect(prisma.usuario.create.mock.calls[1][0].data).toMatchObject({
      cpf: null,
      dataNascimento: null,
      telefone: null,
    });
  });

  it('endereço vazio é ignorado', async () => {
    await service.create({
      papel: 'ADMINISTRADOR',
      email: 'a',
      senha: 's',
      endereco: { numero: '1' },
    } as any);
    await service.create({
      papel: 'ADMINISTRADOR',
      email: 'a',
      senha: 's',
      endereco: { endereco: { numero: '1' } },
    } as any);
    expect(enderecos.findPrincipal).not.toHaveBeenCalled();
  });

  it('CPF repetido vira mensagem clara', async () => {
    const dto = { papel: 'ADMINISTRADOR', email: 'a', senha: 's' } as any;
    prisma.usuario.create.mockRejectedValueOnce(erroCpf(['cpf']));
    await expect(service.create(dto)).rejects.toThrow('Já existe usuário cadastrado com este CPF');
    prisma.usuario.create.mockRejectedValueOnce(erroCpf('usuarios_cpf_key'));
    await expect(service.create(dto)).rejects.toThrow('CPF');
    prisma.usuario.create.mockRejectedValueOnce(erroCpf(['email']));
    await expect(service.create(dto)).rejects.toThrow('dup');
    prisma.usuario.create.mockRejectedValueOnce(erroCpf(undefined));
    await expect(service.create(dto)).rejects.toThrow('dup');
    prisma.usuario.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('outro', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.create(dto)).rejects.toThrow('outro');
    prisma.usuario.create.mockRejectedValueOnce(new Error('qualquer'));
    await expect(service.create(dto)).rejects.toThrow('qualquer');
  });

  it('listas de motoristas, vendedores e usuários', async () => {
    await service.motoristas();
    await service.vendedores();
    prisma.usuario.findMany.mockResolvedValue([{ id: 'u' }]);
    enderecos.findByEntidade.mockResolvedValue([{ id: 'e' }]);
    expect(await service.findAll()).toEqual([{ id: 'u', enderecos: [{ id: 'e' }] }]);
  });

  it('findOne inexistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toThrow('Usuário não encontrado');
  });

  it('atualiza: senha, campos vazios viram null e validação com dados atuais', async () => {
    await service.update('u', {
      senha: 'nova',
      cpf: '',
      telefone: '',
      whatsapp: '',
      dataNascimento: '',
    } as any);
    const data = prisma.usuario.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ cpf: null, telefone: null, whatsapp: null, dataNascimento: null });
    expect(data.senhaHash).toEqual(expect.any(String));
    expect(data.senha).toBeUndefined();

    await service.update('u', { dataNascimento: '1990-01-01' } as any);
    expect(prisma.usuario.update.mock.calls[1][0].data.dataNascimento).toBeInstanceOf(Date);

    // Motorista existente com endereço salvo passa; sem endereço, não
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u', papel: 'MOTORISTA', ...PERFIL });
    enderecos.findByEntidade.mockResolvedValue([
      { principal: false, cep: '9' },
      { principal: true, ...ENDERECO, cidade: { id: 'c' } },
    ]);
    await service.update('u', { nome: 'X' } as any);
    enderecos.findByEntidade.mockResolvedValue([]);
    await expect(service.update('u', { nome: 'X' } as any)).rejects.toThrow('endereço');
    await service.update('u', { endereco: ENDERECO } as any);
    expect(enderecos.create).toHaveBeenCalled();
  });

  it('atualiza: CPF repetido e outros erros', async () => {
    prisma.usuario.update.mockRejectedValueOnce(erroCpf(['cpf']));
    await expect(service.update('u', { cpf: '1' } as any)).rejects.toThrow('CPF');
    prisma.usuario.update.mockRejectedValueOnce(new Error('falhou'));
    await expect(service.update('u', {} as any)).rejects.toThrow('falhou');
  });

  it('desativa e reativa', async () => {
    await service.desativar('u');
    await service.reativar('u');
    expect(prisma.usuario.update.mock.calls.map((c: any) => c[0].data.ativo)).toEqual([
      false,
      true,
    ]);
  });
});
