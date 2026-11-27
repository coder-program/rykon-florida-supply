import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { mensagemAppErrado, papelPodeEntrar } from './apps-acesso';

const hash = bcrypt.hashSync('certa', 4);

describe('AuthService.login', () => {
  let prisma: PrismaMock;
  let jwt: { sign: ReturnType<typeof vi.fn> };
  let service: AuthService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    jwt = { sign: vi.fn(() => 'token') };
    service = new AuthService(prisma as any, jwt as any);
  });
  const usuario = (papel: string, extra: object = {}) => ({
    id: 'u',
    nome: 'Ana',
    email: 'a@a',
    papel,
    ativo: true,
    senhaHash: hash,
    cliente: null,
    ...extra,
  });

  it('recusa usuário inexistente, inativo, cliente desativado e senha errada', async () => {
    await expect(service.login('a@a', 'certa')).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.usuario.findUnique.mockResolvedValue(usuario('VENDEDOR', { ativo: false }));
    await expect(service.login('a@a', 'certa')).rejects.toThrow('Credenciais inválidas');
    prisma.usuario.findUnique.mockResolvedValue(
      usuario('CLIENTE', { cliente: { id: 'c', ativo: false } }),
    );
    await expect(service.login('a@a', 'certa')).rejects.toThrow('cliente está desativado');
    prisma.usuario.findUnique.mockResolvedValue(usuario('VENDEDOR'));
    await expect(service.login('a@a', 'errada')).rejects.toThrow('Credenciais inválidas');
  });

  it('recusa o app errado só depois da senha', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario('MOTORISTA'));
    await expect(service.login('a@a', 'certa', 'vendedor')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('revendedor que também é motorista entra nos dois apps com o mesmo login', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario('REVENDEDOR', { tambemMotorista: true }));
    const r = await service.login('a@a', 'certa', 'motorista');
    expect(r.usuario.tambemMotorista).toBe(true);
    expect(jwt.sign.mock.calls[0][0]).toMatchObject({ papel: 'REVENDEDOR', motorista: true });
    await service.login('a@a', 'certa', 'vendedor');
    prisma.usuario.findUnique.mockResolvedValue(usuario('REVENDEDOR'));
    await expect(service.login('a@a', 'certa', 'motorista')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // A marca só vale para revendedor
    prisma.usuario.findUnique.mockResolvedValue(usuario('VENDEDOR', { tambemMotorista: true }));
    await expect(service.login('a@a', 'certa', 'motorista')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sessão longa para motorista, cliente e TV; padrão para os demais', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario('VENDEDOR'));
    const r = await service.login('a@a', 'certa', 'vendedor');
    expect(r).toMatchObject({ access_token: 'token', usuario: { clienteId: null } });
    expect(jwt.sign.mock.calls[0][1]).toBeUndefined();
    for (const papel of ['MOTORISTA', 'VISAO_GERAL']) {
      prisma.usuario.findUnique.mockResolvedValue(usuario(papel));
      await service.login('a@a', 'certa');
      expect(jwt.sign.mock.calls.at(-1)?.[1]).toEqual({ expiresIn: '30d' });
    }
    prisma.usuario.findUnique.mockResolvedValue(
      usuario('CLIENTE', { cliente: { id: 'c', ativo: true } }),
    );
    expect((await service.login('a@a', 'certa')).usuario.clienteId).toBe('c');
    expect(jwt.sign.mock.calls.at(-1)?.[1]).toEqual({ expiresIn: '30d' });
  });
});

describe('AuthService.definirSenha', () => {
  let prisma: PrismaMock;
  let service: AuthService;
  const futuro = new Date(Date.now() + 86_400_000);
  const cliente = (extra: object = {}) => ({
    id: 'c',
    razaoSocialOuNome: 'Mercado',
    email: 'm@m',
    usuarioId: null,
    statusConvite: 'PENDENTE',
    tokenConviteExpiraEm: futuro,
    ...extra,
  });
  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new AuthService(prisma as any, {} as any);
  });

  it('valida o convite', async () => {
    await expect(service.definirSenha('t', 's')).rejects.toThrow('Convite inválido');
    prisma.cliente.findUnique.mockResolvedValue(cliente({ tokenConviteExpiraEm: null }));
    await expect(service.definirSenha('t', 's')).rejects.toThrow('expirou');
    prisma.cliente.findUnique.mockResolvedValue(cliente({ tokenConviteExpiraEm: new Date(0) }));
    await expect(service.definirSenha('t', 's')).rejects.toThrow('expirou');
    prisma.cliente.findUnique.mockResolvedValue(
      cliente({ statusConvite: 'ATIVO', usuarioId: 'u' }),
    );
    await expect(service.definirSenha('t', 's')).rejects.toThrow('já foi utilizado');
    prisma.cliente.findUnique.mockResolvedValue(cliente({ email: null }));
    await expect(service.definirSenha('t', 's')).rejects.toThrow('sem e-mail');
    prisma.cliente.findUnique.mockResolvedValue(cliente());
    prisma.usuario.findUnique.mockResolvedValue({ id: 'outro' });
    await expect(service.definirSenha('t', 's')).rejects.toThrow('Já existe um usuário');
  });

  it('cria o usuário ou reaproveita o existente', async () => {
    prisma.cliente.findUnique.mockResolvedValue(cliente());
    prisma.usuario.create.mockResolvedValue({ id: 'novo', email: 'm@m' });
    expect(await service.definirSenha('t', 'senha123')).toEqual({ ok: true, email: 'm@m' });
    expect(prisma.cliente.update.mock.calls[0][0].data).toMatchObject({
      usuarioId: 'novo',
      statusConvite: 'ATIVO',
      tokenConvite: null,
    });

    prisma.cliente.findUnique.mockResolvedValue(cliente({ usuarioId: 'u' }));
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u' });
    prisma.usuario.update.mockResolvedValue({ id: 'u', email: 'm@m' });
    await service.definirSenha('t', 'senha123');
    expect(prisma.usuario.update.mock.calls[0][0].where).toEqual({ id: 'u' });
  });
});

describe('acesso', () => {
  it('cada app aceita só os seus perfis', () => {
    expect(papelPodeEntrar('admin', 'SUPERVISOR')).toBe(true);
    expect(papelPodeEntrar('cliente', 'VENDEDOR')).toBe(false);
    expect(mensagemAppErrado('MOTORISTA')).toContain('app do Motorista');
    expect(mensagemAppErrado('NINGUEM' as any)).toBe('Este usuário não tem acesso a este app.');
  });

  it('JwtStrategy exige o segredo e devolve o usuário', async () => {
    const semSegredo = {
      getOrThrow: () => {
        throw new Error('sem segredo');
      },
    };
    expect(() => new JwtStrategy(semSegredo as any)).toThrow();
    const s = new JwtStrategy({ getOrThrow: () => 'segredo' } as any);
    expect(await s.validate({ sub: 'u', email: 'e', papel: 'ADMINISTRADOR' })).toEqual({
      id: 'u',
      email: 'e',
      papel: 'ADMINISTRADOR',
      motorista: false,
    });
  });

  const contexto = (papel?: string) =>
    ({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ user: papel ? { papel } : undefined }) }),
    }) as any;

  it('RolesGuard', () => {
    const guard = (papeis?: string[]) => new RolesGuard({ getAllAndOverride: () => papeis } as any);
    expect(guard(undefined).canActivate(contexto('VENDEDOR'))).toBe(true);
    expect(guard([]).canActivate(contexto('VENDEDOR'))).toBe(true);
    expect(guard(['ADMINISTRADOR']).canActivate(contexto('VENDEDOR'))).toBe(false);
    expect(guard(['ADMINISTRADOR']).canActivate(contexto())).toBe(false);
    expect(guard(['ADMINISTRADOR']).canActivate(contexto('ADMINISTRADOR'))).toBe(true);
    // Revendedor que também é motorista passa nas rotas do motorista
    const hugo = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({ user: { papel: 'REVENDEDOR', motorista: true } }),
      }),
    } as any;
    expect(guard(['MOTORISTA', 'SUPERVISOR']).canActivate(hugo)).toBe(true);
    expect(guard(['ADMINISTRADOR']).canActivate(hugo)).toBe(false);
  });

  it('JwtAuthGuard: TV só entra onde a rota libera', async () => {
    const pai = vi.spyOn((AuthGuard('jwt') as any).prototype, 'canActivate');
    const guard = (papeis?: string[]) =>
      new JwtAuthGuard({ getAllAndOverride: () => papeis } as any);

    pai.mockResolvedValue(false);
    expect(await guard().canActivate(contexto('VENDEDOR'))).toBe(false);
    pai.mockResolvedValue(true);
    expect(await guard().canActivate(contexto('VENDEDOR'))).toBe(true);
    await expect(guard().canActivate(contexto('VISAO_GERAL'))).rejects.toThrow('Visão geral');
    await expect(guard(['ADMINISTRADOR']).canActivate(contexto('VISAO_GERAL'))).rejects.toThrow();
    expect(await guard(['VISAO_GERAL']).canActivate(contexto('VISAO_GERAL'))).toBe(true);
    pai.mockRestore();
  });
});
