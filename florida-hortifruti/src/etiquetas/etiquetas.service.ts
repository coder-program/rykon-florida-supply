import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusPedido } from '@prisma/client';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EtiquetasService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async gerarParaPedido(pedidoId: string) {
    return this.prisma.etiqueta.create({ data: { pedidoId } });
  }

  async garantirParaPedido(pedidoId: string) {
    const existente = await this.prisma.etiqueta.findUnique({ where: { pedidoId } });
    if (existente) return existente;

    const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');

    const statusOk: StatusPedido[] = [
      StatusPedido.APROVADO,
      StatusPedido.EM_SEPARACAO,
      StatusPedido.PRONTO_PARA_ENTREGA,
      StatusPedido.EM_ENTREGA,
      StatusPedido.ENTREGUE,
    ];
    if (!statusOk.includes(pedido.status)) {
      throw new BadRequestException('Etiqueta só pode ser gerada após a aprovação do pedido');
    }

    return this.prisma.etiqueta.create({ data: { pedidoId } });
  }

  // Retorna dados completos da etiqueta para exibição/impressão (item 34.1)
  async buscarCompleto(etiquetaId: string) {
    const etiqueta = await this.prisma.etiqueta.findUnique({
      where: { id: etiquetaId },
      include: {
        pedido: {
          include: {
            cliente: true,
            vendedor: true,
            itens: { include: { produto: true } },
          },
        },
      },
    });
    if (!etiqueta) throw new NotFoundException('Etiqueta não encontrada');

    const urlPublica = this.urlDoQr(etiqueta.tokenPublico);
    const qrCodeDataUrl = await QRCode.toDataURL(urlPublica, { width: 220, margin: 1 });

    const { pedido } = etiqueta;
    const totalCaixas = Math.max(
      1,
      pedido.itens.reduce((acc, item) => acc + Math.round(Number(item.quantidade)), 0),
    );
    const enderecos = await this.prisma.endereco.findMany({
      where: {
        entidadeTipo: 'CLIENTE',
        entidadeId: pedido.clienteId,
      },
      include: { cidade: { include: { estado: true } } },
      orderBy: [{ principal: 'desc' }, { criadoEm: 'asc' }],
    });
    const enderecoPrincipal = enderecos.find((endereco) => endereco.principal) ?? enderecos[0];
    return {
      id: etiqueta.id,
      tokenPublico: etiqueta.tokenPublico,
      geradaEm: etiqueta.geradaEm,
      reimpressoes: etiqueta.reimpressoes,
      urlPublica,
      qrCodeDataUrl,
      // Dados da empresa (item 34.1)
      empresa: {
        nome: 'Flórida Hortifruti',
        cnpj: '00.000.000/0000-00', // substituir pelo CNPJ real
        telefone: '(11) 00000-0000', // substituir pelo telefone real
      },
      // Dados do pedido (item 34.1)
      pedido: {
        numero: pedido.numero,
        data: pedido.data,
        status: pedido.status,
        observacoes: pedido.observacoes,
      },
      // Dados do vendedor (item 34.1)
      vendedor: {
        nome: pedido.vendedor?.nome ?? '—',
      },
      // Dados do cliente (item 34.1)
      cliente: {
        razaoSocialOuNome: pedido.cliente.razaoSocialOuNome,
        nomeFantasia: pedido.cliente.nomeFantasia,
        endereco: enderecoPrincipal?.logradouro ?? '',
        cidade: enderecoPrincipal?.cidade?.nome ?? '',
        estado:
          enderecoPrincipal?.cidade?.estado?.sigla ?? enderecoPrincipal?.cidade?.estado?.nome ?? '',
        telefone: pedido.cliente.telefone,
      },
      totalCaixas,
      // Produtos (item 34.1)
      itens: pedido.itens.map((i) => ({
        codigo: i.produto.codigoInterno,
        nome: i.produto.nome,
        quantidade: Number(i.quantidade),
        unidade: i.produto.unidadeVenda,
      })),
    };
  }

  async gerarQRCode(etiquetaId: string) {
    const etiqueta = await this.prisma.etiqueta.findUnique({ where: { id: etiquetaId } });
    if (!etiqueta) throw new NotFoundException('Etiqueta não encontrada');

    const urlPublica = this.urlDoQr(etiqueta.tokenPublico);
    const pngDataUrl = await QRCode.toDataURL(urlPublica);

    return { urlPublica, pngDataUrl };
  }

  async marcarReimpressao(etiquetaId: string) {
    return this.prisma.etiqueta.update({
      where: { id: etiquetaId },
      data: { reimpressoes: { increment: 1 } },
    });
  }

  // Página pública acessada ao ler o QR Code — sem dados financeiros (item 34.2)
  async buscarPorToken(token: string) {
    const etiqueta = await this.prisma.etiqueta.findUnique({
      where: { tokenPublico: token },
      include: {
        pedido: {
          include: { cliente: true, vendedor: true, itens: { include: { produto: true } } },
        },
      },
    });
    if (!etiqueta) throw new NotFoundException('Etiqueta não encontrada');

    const { pedido } = etiqueta;
    const enderecos = await this.prisma.endereco.findMany({
      where: {
        entidadeTipo: 'CLIENTE',
        entidadeId: pedido.clienteId,
      },
      include: { cidade: { include: { estado: true } } },
      orderBy: [{ principal: 'desc' }, { criadoEm: 'asc' }],
    });
    const enderecoPrincipal = enderecos.find((endereco) => endereco.principal) ?? enderecos[0];
    return {
      pedidoId: pedido.id,
      numero: pedido.numero,
      data: pedido.data,
      status: pedido.status,
      cliente: {
        razaoSocialOuNome: pedido.cliente.razaoSocialOuNome,
        nomeFantasia: pedido.cliente.nomeFantasia,
        endereco: enderecoPrincipal?.logradouro ?? '',
        cidade: enderecoPrincipal?.cidade?.nome ?? '',
        estado:
          enderecoPrincipal?.cidade?.estado?.sigla ?? enderecoPrincipal?.cidade?.estado?.nome ?? '',
      },
      vendedor: pedido.vendedor?.nome ?? '—',
      produtos: pedido.itens.map((i) => ({
        codigo: i.produto.codigoInterno,
        produto: i.produto.nome,
        quantidade: Number(i.quantidade),
        unidade: i.produto.unidadeVenda,
      })),
      // valores financeiros intencionalmente omitidos (item 34.2)
    };
  }

  private urlDoQr(token: string) {
    const pwa = this.config.get<string>('PWA_PUBLIC_URL')?.replace(/\/$/, '');
    if (pwa) return `${pwa}/abrir-pedido/${token}`;
    const base = this.config.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ?? '';
    return `${base}/p/${token}`;
  }
}
