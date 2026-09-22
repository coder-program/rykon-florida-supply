import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusPedido, TipoEntidadeEndereco } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { StorageService } from '../common/storage.service';
import { ConfirmarEntregaMotoristaDto } from '../pedidos/dto/pedido.dto';
import { registrarHistoricoStatus } from '../pedidos/historico-status.util';

const STATUS_LISTA: StatusPedido[] = [
  StatusPedido.APROVADO,
  StatusPedido.EM_SEPARACAO,
  StatusPedido.PRONTO_PARA_ENTREGA,
  StatusPedido.EM_ENTREGA,
];

@Injectable()
export class MotoristaService {
  constructor(
    private prisma: PrismaService,
    private enderecos: EnderecosService,
    private storage: StorageService,
  ) {}

  // Aceita tanto o token puro quanto a URL completa lida da câmera (ex.: .../p/<token>)
  private extrairToken(raw: string) {
    const valor = String(raw ?? '').trim();
    if (!valor) return '';
    const match = valor.match(/(?:\/abrir-pedido\/|\/p\/)?([0-9a-fA-F-]{36})$/);
    return match?.[1] ?? valor;
  }

  private async garantirPedido(id: string, motoristaId: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: {
          select: {
            id: true,
            razaoSocialOuNome: true,
            nomeFantasia: true,
            telefone: true,
            whatsapp: true,
          },
        },
        itens: { include: { produto: { select: { id: true, nome: true, unidadeVenda: true } } } },
        comprovanteEntrega: true,
      },
    });
    if (!pedido) throw new NotFoundException('Entrega não encontrada');
    if (pedido.entregadorId !== motoristaId) {
      throw new ForbiddenException('Esta entrega não está atribuída a você');
    }
    return pedido;
  }

  private async formatar(pedido: any) {
    const enderecos = await this.enderecos.findByEntidade(
      TipoEntidadeEndereco.CLIENTE,
      pedido.clienteId,
    );
    const endereco =
      enderecos.find((e) => e.tipo === 'ENTREGA') ??
      enderecos.find((e) => e.principal) ??
      enderecos[0] ??
      null;
    return {
      id: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      data: pedido.data,
      observacoes: pedido.observacoes,
      cliente: pedido.cliente,
      endereco,
      itens: pedido.itens.map((i: any) => ({
        produtoId: i.produtoId,
        nome: i.produto?.nome,
        unidadeVenda: i.produto?.unidadeVenda,
        quantidade: Number(i.quantidade),
      })),
      comprovante: pedido.comprovanteEntrega
        ? {
            nomeRecebedor: pedido.comprovanteEntrega.nomeRecebedor,
            dataHora: pedido.comprovanteEntrega.dataHora,
            fotoUrl: pedido.comprovanteEntrega.fotoUrl,
          }
        : null,
    };
  }

  async listar(motoristaId: string) {
    const pedidos = await this.prisma.pedido.findMany({
      where: { entregadorId: motoristaId, status: { in: STATUS_LISTA } },
      include: {
        cliente: {
          select: {
            id: true,
            razaoSocialOuNome: true,
            nomeFantasia: true,
            telefone: true,
            whatsapp: true,
          },
        },
        itens: { include: { produto: { select: { id: true, nome: true, unidadeVenda: true } } } },
        comprovanteEntrega: true,
      },
      orderBy: { data: 'asc' },
    });
    return Promise.all(pedidos.map((p) => this.formatar(p)));
  }

  async detalhe(id: string, motoristaId: string) {
    return this.formatar(await this.garantirPedido(id, motoristaId));
  }

  async iniciar(id: string, motoristaId: string) {
    const pedido = await this.garantirPedido(id, motoristaId);
    if (
      pedido.status !== StatusPedido.PRONTO_PARA_ENTREGA &&
      pedido.status !== StatusPedido.APROVADO &&
      pedido.status !== StatusPedido.EM_SEPARACAO
    ) {
      throw new BadRequestException('Esta entrega não pode ser iniciada neste status');
    }
    await this.prisma.pedido.update({
      where: { id },
      data: { status: StatusPedido.EM_ENTREGA },
    });
    await registrarHistoricoStatus(this.prisma, id, StatusPedido.EM_ENTREGA);
    return this.detalhe(id, motoristaId);
  }

  // Chamado quando o motorista lê o QR Code da etiqueta pela câmera do celular (item 34.6)
  async iniciarPorToken(tokenBruto: string, motoristaId: string) {
    const token = this.extrairToken(tokenBruto);
    const etiqueta = await this.prisma.etiqueta.findUnique({ where: { tokenPublico: token } });
    if (!etiqueta) throw new NotFoundException('Etiqueta não encontrada');

    const pedido = await this.garantirPedido(etiqueta.pedidoId, motoristaId);
    // Idempotente: se já estiver em entrega/entregue, apenas retorna o estado atual sem erro
    if (pedido.status === StatusPedido.EM_ENTREGA || pedido.status === StatusPedido.ENTREGUE) {
      return this.detalhe(etiqueta.pedidoId, motoristaId);
    }
    return this.iniciar(etiqueta.pedidoId, motoristaId);
  }

  async confirmar(
    id: string,
    motoristaId: string,
    dto: ConfirmarEntregaMotoristaDto,
    arquivo?: { buffer: Buffer; mimetype?: string },
  ) {
    const pedido = await this.garantirPedido(id, motoristaId);
    if (!STATUS_LISTA.includes(pedido.status) && pedido.status !== StatusPedido.EM_ENTREGA) {
      throw new BadRequestException('Pedido não pode ser confirmado neste status');
    }
    if (pedido.comprovanteEntrega) {
      throw new BadRequestException('Esta entrega já foi confirmada');
    }

    const nomeRecebedor = dto.nomeRecebedor?.trim();
    if (!nomeRecebedor) throw new BadRequestException('Informe o nome de quem recebeu');

    let fotoUrl = '';
    if (arquivo?.buffer?.length) {
      fotoUrl = await this.storage.salvarImagem(arquivo.buffer, arquivo.mimetype || 'image/jpeg');
    } else if (dto.fotoEntrega?.startsWith('data:image/')) {
      fotoUrl = await this.storage.salvarDataUrl(dto.fotoEntrega);
    }
    if (!fotoUrl) throw new BadRequestException('A foto da entrega é obrigatória');

    const agora = new Date();
    await this.prisma.$transaction([
      this.prisma.comprovanteEntrega.create({
        data: {
          pedidoId: id,
          motoristaId,
          fotoUrl,
          nomeRecebedor,
          dataHora: agora,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          observacao: dto.observacao?.trim() || null,
        },
      }),
      this.prisma.pedido.update({
        where: { id },
        data: {
          status: StatusPedido.ENTREGUE,
          entregueEm: agora,
          recebidoPor: nomeRecebedor,
          observacaoEntrega: dto.observacao?.trim() || null,
          fotoEntrega: fotoUrl,
        },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId: motoristaId,
          acao: 'CONFIRMAR_ENTREGA_MOTORISTA',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: { nomeRecebedor, temFoto: true },
        },
      }),
      this.prisma.historicoStatusPedido.create({
        data: { pedidoId: id, status: StatusPedido.ENTREGUE },
      }),
    ]);
    return this.detalhe(id, motoristaId);
  }
}
