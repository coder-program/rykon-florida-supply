import { beforeEach, describe, expect, it } from 'vitest';
import { criarPrismaMock, type PrismaMock } from '../test-utils/prisma-mock';
import { EtiquetasService } from './etiquetas.service';

const pedido = (extra: object = {}) => ({
  id: 'p',
  numero: 181,
  data: new Date('2026-11-07'),
  status: 'APROVADO',
  observacoes: null,
  clienteId: 'c',
  cliente: { razaoSocialOuNome: 'Mercado', nomeFantasia: 'VV', telefone: '11' },
  vendedor: { nome: 'Cesar' },
  itens: [
    {
      produtoId: 'a',
      quantidade: 4,
      produto: { codigoInterno: 'M1', nome: 'Morango', unidadeVenda: 'CX' },
    },
    {
      produtoId: 'b',
      quantidade: 0.4,
      produto: { codigoInterno: 'U1', nome: 'Uva', unidadeVenda: 'CX' },
    },
  ],
  ...extra,
});

const etiqueta = (extra: object = {}) => ({
  id: 'e',
  tokenPublico: 'tok',
  geradaEm: new Date(),
  dataEmbalagem: new Date(),
  reimpressoes: 0,
  pedido: pedido(),
  ...extra,
});

const enderecos = [
  { principal: false, logradouro: 'Secundária', cidade: null },
  { principal: true, logradouro: 'Rua A', cidade: { nome: 'SP', estado: { sigla: 'SP' } } },
];

describe('EtiquetasService', () => {
  let prisma: PrismaMock;
  const config: Record<string, string | undefined> = {};
  let service: EtiquetasService;
  beforeEach(() => {
    prisma = criarPrismaMock();
    for (const k of Object.keys(config)) delete config[k];
    service = new EtiquetasService(prisma as any, { get: (k: string) => config[k] } as any);
  });

  it('gera etiqueta', async () => {
    await service.gerarParaPedido('p');
    expect(prisma.etiqueta.create).toHaveBeenCalledWith({ data: { pedidoId: 'p' } });
  });

  it('garante: reaproveita, exige pedido aprovado e passa para separação', async () => {
    prisma.etiqueta.findUnique.mockResolvedValueOnce({ id: 'existe' });
    expect(await service.garantirParaPedido('p')).toEqual({ id: 'existe' });

    await expect(service.garantirParaPedido('p')).rejects.toThrow('Pedido não encontrado');
    prisma.pedido.findUnique.mockResolvedValue({ status: 'AGUARDANDO_APROVACAO' });
    await expect(service.garantirParaPedido('p')).rejects.toThrow('após a aprovação');

    prisma.etiqueta.create.mockResolvedValue({ id: 'nova' });
    prisma.pedido.findUnique.mockResolvedValue({ status: 'APROVADO' });
    expect(await service.garantirParaPedido('p')).toEqual({ id: 'nova' });
    expect(prisma.pedido.update.mock.calls[0][0].data).toEqual({ status: 'EM_SEPARACAO' });
    expect(prisma.historicoStatusPedido.create).toHaveBeenCalled();

    prisma.pedido.findUnique.mockResolvedValue({ status: 'EM_ENTREGA' });
    await service.garantirParaPedido('p');
    expect(prisma.pedido.update).toHaveBeenCalledTimes(1);
  });

  it('dados completos: fixa a embalagem, endereço principal e lotes por produto', async () => {
    await expect(service.buscarCompleto('e')).rejects.toThrow('Etiqueta não encontrada');

    config.PWA_PUBLIC_URL = 'https://app.x/';
    prisma.etiqueta.findUnique.mockResolvedValue(etiqueta({ dataEmbalagem: null }));
    prisma.etiqueta.update.mockResolvedValue(etiqueta());
    prisma.endereco.findMany.mockResolvedValue(enderecos);
    prisma.itemPedidoLote.findMany.mockResolvedValue([
      { produtoId: 'a', lote: { numero: '77' } },
      { produtoId: 'a', lote: { numero: '77' } },
      { produtoId: 'a', lote: { numero: '78' } },
    ]);
    const r = await service.buscarCompleto('e');
    expect(prisma.etiqueta.update).toHaveBeenCalled();
    expect(r.urlPublica).toBe('https://app.x/abrir-pedido/tok');
    expect(r.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(r.cliente).toMatchObject({ endereco: 'Rua A', cidade: 'SP', estado: 'SP' });
    expect(r.totalCaixas).toBe(4);
    expect(r.itens.map((i) => i.lotes)).toEqual([['77', '78'], []]);
  });

  it('dados completos sem endereço, sem vendedor e com estado sem sigla', async () => {
    prisma.etiqueta.findUnique.mockResolvedValue(
      etiqueta({ pedido: pedido({ vendedor: null, itens: [] }) }),
    );
    prisma.endereco.findMany.mockResolvedValue([]);
    prisma.itemPedidoLote.findMany.mockResolvedValue([]);
    const r = await service.buscarCompleto('e');
    expect(r).toMatchObject({ totalCaixas: 1, vendedor: { nome: '—' } });
    expect(r.cliente).toMatchObject({ endereco: '', cidade: '', estado: '' });
    expect(r.urlPublica).toBe('/p/tok');

    prisma.endereco.findMany.mockResolvedValue([
      { principal: false, logradouro: 'R', cidade: { nome: 'X', estado: { nome: 'Paraná' } } },
    ]);
    expect((await service.buscarCompleto('e')).cliente.estado).toBe('Paraná');
  });

  it('QR code e reimpressão', async () => {
    await expect(service.gerarQRCode('e')).rejects.toThrow('Etiqueta não encontrada');
    config.APP_PUBLIC_URL = 'https://api.x/';
    prisma.etiqueta.findUnique.mockResolvedValue(etiqueta());
    const r = await service.gerarQRCode('e');
    expect(r.urlPublica).toBe('https://api.x/p/tok');
    await service.marcarReimpressao('e');
    expect(prisma.etiqueta.update.mock.calls[0][0].data).toEqual({
      reimpressoes: { increment: 1 },
    });
  });

  it('página pública sem valores', async () => {
    await expect(service.buscarPorToken('tok')).rejects.toThrow('Etiqueta não encontrada');
    prisma.etiqueta.findUnique.mockResolvedValue(etiqueta());
    prisma.endereco.findMany.mockResolvedValue(enderecos);
    const r = await service.buscarPorToken('tok');
    expect(r).toMatchObject({ numero: 181, vendedor: 'Cesar', cliente: { cidade: 'SP' } });
    expect(JSON.stringify(r)).not.toMatch(/valor/i);

    prisma.etiqueta.findUnique.mockResolvedValue(etiqueta({ pedido: pedido({ vendedor: null }) }));
    prisma.endereco.findMany.mockResolvedValue([
      { principal: false, logradouro: 'R', cidade: { nome: 'X', estado: { nome: 'Paraná' } } },
    ]);
    expect(await service.buscarPorToken('tok')).toMatchObject({
      vendedor: '—',
      cliente: { estado: 'Paraná' },
    });
    prisma.endereco.findMany.mockResolvedValue([]);
    expect((await service.buscarPorToken('tok')).cliente).toMatchObject({
      endereco: '',
      estado: '',
    });
  });
});
