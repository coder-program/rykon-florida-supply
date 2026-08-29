import { Injectable, NotFoundException } from '@nestjs/common';
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

    const baseUrl = this.config.get<string>('APP_PUBLIC_URL');
    const urlPublica = `${baseUrl}/p/${etiqueta.tokenPublico}`;
    const qrCodeDataUrl = await QRCode.toDataURL(urlPublica, { width: 200, margin: 1 });

    const { pedido } = etiqueta;
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
        telefone: '(11) 00000-0000',  // substituir pelo telefone real
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
        nome: pedido.vendedor.nome,
      },
      // Dados do cliente (item 34.1)
      cliente: {
        razaoSocialOuNome: pedido.cliente.razaoSocialOuNome,
        nomeFantasia: pedido.cliente.nomeFantasia,
        endereco: pedido.cliente.endereco,
        cidade: pedido.cliente.cidade,
        estado: pedido.cliente.estado,
        telefone: pedido.cliente.telefone,
      },
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

    const baseUrl = this.config.get<string>('APP_PUBLIC_URL');
    const urlPublica = `${baseUrl}/p/${etiqueta.tokenPublico}`;
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
    return {
      numero: pedido.numero,
      data: pedido.data,
      status: pedido.status,
      cliente: {
        razaoSocialOuNome: pedido.cliente.razaoSocialOuNome,
        nomeFantasia: pedido.cliente.nomeFantasia,
        endereco: pedido.cliente.endereco,
        cidade: pedido.cliente.cidade,
        estado: pedido.cliente.estado,
      },
      vendedor: pedido.vendedor.nome,
      produtos: pedido.itens.map((i) => ({
        codigo: i.produto.codigoInterno,
        produto: i.produto.nome,
        quantidade: Number(i.quantidade),
        unidade: i.produto.unidadeVenda,
      })),
      // valores financeiros intencionalmente omitidos (item 34.2)
    };
  }
}
