import { Injectable, Logger } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma.service';
import { InscricaoPushDto } from './dto/push.dto';

export const TIPO_PEDIDO_A_CAMINHO = 'PEDIDO_A_CAMINHO';

// Avisos automáticos para o cliente: grava no portal (tela de Avisos) e manda
// Web Push para os celulares/navegadores em que ele ativou as notificações.
@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);
  private readonly pushAtivo: boolean;

  constructor(private prisma: PrismaService) {
    const publica = process.env.VAPID_PUBLIC_KEY;
    const privada = process.env.VAPID_PRIVATE_KEY;
    this.pushAtivo = !!(publica && privada);
    if (this.pushAtivo) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:contato@floridasupply.com.br',
        publica!,
        privada!,
      );
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes: push desativado');
    }
  }

  chavePublica() {
    return { chavePublica: this.pushAtivo ? process.env.VAPID_PUBLIC_KEY : null };
  }

  async inscrever(usuarioId: string, dto: InscricaoPushDto) {
    await this.prisma.pushInscricao.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        usuarioId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: { usuarioId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    });
    return { ok: true };
  }

  async cancelarInscricao(usuarioId: string, endpoint: string) {
    await this.prisma.pushInscricao.deleteMany({ where: { usuarioId, endpoint } });
    return { ok: true };
  }

  // Motorista iniciou a rota: avisa o cliente que o pedido está a caminho.
  // Nunca lança erro — falha de aviso não pode travar a entrega.
  async pedidoACaminho(pedidoId: string) {
    try {
      const pedido = await this.prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: {
          id: true,
          numero: true,
          clienteId: true,
          cliente: { select: { usuarioId: true } },
          vendedor: { select: { papel: true } },
        },
      });
      if (!pedido?.clienteId) return;
      // Pedido do revendedor não aparece para o cliente no portal
      if (pedido.vendedor?.papel === PapelUsuario.REVENDEDOR) return;

      // Mesmo pedido saindo de novo para entrega não gera aviso repetido
      const existente = await this.prisma.notificacaoCliente.findFirst({
        where: { pedidoId, tipo: TIPO_PEDIDO_A_CAMINHO },
        select: { id: true },
      });
      if (existente) return;

      const titulo = 'Seu pedido está a caminho';
      const mensagem = `O pedido #${pedido.numero} saiu para entrega e logo chega até você.`;
      await this.prisma.notificacaoCliente.create({
        data: {
          clienteId: pedido.clienteId,
          pedidoId,
          tipo: TIPO_PEDIDO_A_CAMINHO,
          titulo,
          mensagem,
          status: 'ENVIADA',
          enviadaEm: new Date(),
        },
      });

      if (pedido.cliente?.usuarioId) {
        await this.enviarPush(pedido.cliente.usuarioId, {
          titulo,
          mensagem,
          url: `/pedidos/${pedidoId}`,
          tag: `pedido-${pedidoId}`,
        });
      }
    } catch (err) {
      this.logger.error(`Falha ao avisar pedido a caminho (${pedidoId})`, err as Error);
    }
  }

  private async enviarPush(
    usuarioId: string,
    payload: { titulo: string; mensagem: string; url: string; tag: string },
  ) {
    if (!this.pushAtivo) return;
    const inscricoes = await this.prisma.pushInscricao.findMany({ where: { usuarioId } });
    const corpo = JSON.stringify(payload);

    await Promise.all(
      inscricoes.map(async (inscricao) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: inscricao.endpoint,
              keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
            },
            corpo,
            { TTL: 60 * 60 * 6 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // Inscrição expirada ou removida no aparelho: limpa para não tentar de novo
          if (status === 404 || status === 410) {
            await this.prisma.pushInscricao.deleteMany({ where: { id: inscricao.id } });
          } else {
            this.logger.warn(`Push falhou (${status ?? 'sem status'}) para ${usuarioId}`);
          }
        }
      }),
    );
  }
}
