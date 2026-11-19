import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { MotoristaService } from './motorista.service';

const TOKEN = '123e4567-e89b-12d3-a456-426614174000';

const pedido = (extra: object = {}) => ({
  id: 'p',
  numero: 1,
  status: 'PRONTO_PARA_ENTREGA',
  entregadorId: 'm',
  clienteId: 'c',
  cliente: { id: 'c' },
  itens: [{ produtoId: 'a', quantidade: 2, produto: { nome: 'Morango', unidadeVenda: 'CX' } }],
  comprovanteEntrega: null,
  ...extra,
});

describe('MotoristaService', () => {
  let prisma: PrismaMock;
  let enderecos: { findByEntidade: ReturnType<typeof vi.fn> };
  let storage: { salvarImagem: ReturnType<typeof vi.fn>; salvarDataUrl: ReturnType<typeof vi.fn> };
  let notificacoes: { pedidoACaminho: ReturnType<typeof vi.fn> };
  let service: MotoristaService;

  beforeEach(() => {
    prisma = criarPrismaMock();
    enderecos = { findByEntidade: vi.fn(async () => []) };
    storage = {
      salvarImagem: vi.fn(async () => '/uploads/a.jpg'),
      salvarDataUrl: vi.fn(async () => '/uploads/b.jpg'),
    };
    notificacoes = { pedidoACaminho: vi.fn(async () => undefined) };
    service = new MotoristaService(
      prisma as any,
      enderecos as any,
      storage as any,
      notificacoes as any,
    );
    prisma.pedido.findUnique.mockResolvedValue(pedido());
  });

  it('lista com o endereço de entrega, o principal ou o primeiro', async () => {
    prisma.pedido.findMany.mockResolvedValue([pedido(), pedido(), pedido(), pedido()]);
    enderecos.findByEntidade
      .mockResolvedValueOnce([{ tipo: 'PRINCIPAL', principal: true }, { tipo: 'ENTREGA' }])
      .mockResolvedValueOnce([
        { tipo: 'COBRANCA', principal: false },
        { tipo: 'PRINCIPAL', principal: true },
      ])
      .mockResolvedValueOnce([{ tipo: 'COBRANCA', principal: false }])
      .mockResolvedValueOnce([]);
    const lista = await service.listar('m');
    expect(lista.map((p) => p.endereco?.tipo ?? null)).toEqual([
      'ENTREGA',
      'PRINCIPAL',
      'COBRANCA',
      null,
    ]);
    expect(lista[0].itens[0]).toEqual({
      produtoId: 'a',
      nome: 'Morango',
      unidadeVenda: 'CX',
      quantidade: 2,
    });
  });

  it('registra localização', async () => {
    expect(await service.registrarLocalizacao('m', { latitude: 1, longitude: 2 })).toEqual({
      ok: true,
    });
    expect(prisma.localizacaoMotorista.upsert.mock.calls[0][0].create.precisao).toBeNull();
    await service.registrarLocalizacao('m', { latitude: 1, longitude: 2, precisao: 5 });
    expect(prisma.localizacaoMotorista.upsert.mock.calls[1][0].update.precisao).toBe(5);
  });

  it('detalhe só da entrega dele, com comprovante', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(null);
    await expect(service.detalhe('p', 'm')).rejects.toThrow('Entrega não encontrada');
    prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ entregadorId: 'outro' }));
    await expect(service.detalhe('p', 'm')).rejects.toThrow('não está atribuída a você');
    prisma.pedido.findUnique.mockResolvedValueOnce(
      pedido({ comprovanteEntrega: { nomeRecebedor: 'Ana', dataHora: 'h', fotoUrl: 'f' } }),
    );
    expect((await service.detalhe('p', 'm')).comprovante).toEqual({
      nomeRecebedor: 'Ana',
      dataHora: 'h',
      fotoUrl: 'f',
    });
  });

  it('inicia a entrega e avisa o cliente', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'ENTREGUE' }));
    await expect(service.iniciar('p', 'm')).rejects.toThrow('não pode ser iniciada');
    for (const status of ['PRONTO_PARA_ENTREGA', 'APROVADO', 'EM_SEPARACAO']) {
      prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status }));
      await service.iniciar('p', 'm');
    }
    expect(prisma.pedido.update.mock.calls[0][0].data).toEqual({ status: 'EM_ENTREGA' });
    expect(notificacoes.pedidoACaminho).toHaveBeenCalledTimes(3);
  });

  it('inicia pelo QR code (token puro ou URL) e é idempotente', async () => {
    await expect(service.iniciarPorToken('', 'm')).rejects.toThrow('Etiqueta não encontrada');
    expect(prisma.etiqueta.findUnique.mock.calls[0][0].where.tokenPublico).toBe('');
    await expect(service.iniciarPorToken('abc', 'm')).rejects.toThrow();
    expect(prisma.etiqueta.findUnique.mock.calls[1][0].where.tokenPublico).toBe('abc');

    prisma.etiqueta.findUnique.mockResolvedValue({ pedidoId: 'p' });
    await service.iniciarPorToken(`https://app.x/abrir-pedido/${TOKEN}`, 'm');
    expect(prisma.etiqueta.findUnique.mock.calls[2][0].where.tokenPublico).toBe(TOKEN);
    expect(prisma.pedido.update).toHaveBeenCalledTimes(1);

    prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'EM_ENTREGA' }));
    await service.iniciarPorToken(TOKEN, 'm');
    prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'ENTREGUE' }));
    await service.iniciarPorToken(undefined as any, 'm');
    expect(prisma.pedido.update).toHaveBeenCalledTimes(1);
  });

  it('confirma a entrega: status, comprovante, nome e foto obrigatórios', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ status: 'ENTREGUE' }));
    await expect(service.confirmar('p', 'm', {} as any)).rejects.toThrow('não pode ser confirmado');
    prisma.pedido.findUnique.mockResolvedValueOnce(pedido({ comprovanteEntrega: { id: 'x' } }));
    await expect(service.confirmar('p', 'm', {} as any)).rejects.toThrow('já foi confirmada');
    await expect(service.confirmar('p', 'm', { nomeRecebedor: '  ' } as any)).rejects.toThrow(
      'nome de quem recebeu',
    );
    await expect(
      service.confirmar('p', 'm', { nomeRecebedor: 'Ana', fotoEntrega: 'http://x' } as any),
    ).rejects.toThrow('foto da entrega é obrigatória');
    await expect(
      service.confirmar('p', 'm', { nomeRecebedor: 'Ana' } as any, { buffer: Buffer.alloc(0) }),
    ).rejects.toThrow('foto');
  });

  it('confirma com arquivo ou com foto em data URL', async () => {
    await service.confirmar(
      'p',
      'm',
      { nomeRecebedor: ' Ana ', observacao: ' portão ', latitude: 1, longitude: 2 } as any,
      { buffer: Buffer.from('x'), mimetype: 'image/png' },
    );
    expect(storage.salvarImagem).toHaveBeenCalledWith(expect.any(Buffer), 'image/png');
    expect(prisma.comprovanteEntrega.create.mock.calls[0][0].data).toMatchObject({
      nomeRecebedor: 'Ana',
      observacao: 'portão',
      latitude: 1,
    });
    expect(prisma.pedido.update.mock.calls[0][0].data).toMatchObject({
      status: 'ENTREGUE',
      recebidoPor: 'Ana',
      fotoEntrega: '/uploads/a.jpg',
    });

    prisma.pedido.findUnique.mockResolvedValue(pedido({ status: 'EM_ENTREGA' }));
    await service.confirmar('p', 'm', { nomeRecebedor: 'Ana' } as any, {
      buffer: Buffer.from('x'),
    });
    expect(storage.salvarImagem).toHaveBeenLastCalledWith(expect.any(Buffer), 'image/jpeg');
    await service.confirmar('p', 'm', {
      nomeRecebedor: 'Ana',
      fotoEntrega: 'data:image/png;base64,eA==',
    } as any);
    expect(storage.salvarDataUrl).toHaveBeenCalled();
    expect(prisma.comprovanteEntrega.create.mock.calls[2][0].data).toMatchObject({
      latitude: null,
      observacao: null,
    });
  });
});
