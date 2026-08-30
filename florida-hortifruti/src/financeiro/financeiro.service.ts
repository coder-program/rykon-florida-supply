import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StatusPedido, StatusPagamento, FormaPagamento } from '@prisma/client';

@Injectable()
export class FinanceiroService {
  constructor(private prisma: PrismaService) {}

  private get hoje() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // Classifica se um pedido está vencido com base na dataVencimento
  private isVencido(pedido: any): boolean {
    if (pedido.statusPagamento === StatusPagamento.PAGO) return false;
    if (!pedido.dataVencimento) return false;
    return new Date(pedido.dataVencimento) < new Date();
  }

  // KPIs do painel financeiro
  async resumo(dataInicio?: string, dataFim?: string) {
    const whereBase: any = {
      status: { notIn: [StatusPedido.RASCUNHO, StatusPedido.CANCELADO] },
    };

    const periodoData: any = {};
    if (dataInicio) periodoData.gte = new Date(dataInicio);
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      periodoData.lte = fim;
    }

    // Total recebido no período
    const recebidos = await this.prisma.pedido.aggregate({
      where: { ...whereBase, statusPagamento: StatusPagamento.PAGO, ...(Object.keys(periodoData).length ? { data: periodoData } : {}) },
      _sum: { totalFinal: true },
      _count: { id: true },
    });

    // Em aberto (todos, independente de período)
    const emAberto = await this.prisma.pedido.aggregate({
      where: { ...whereBase, statusPagamento: StatusPagamento.EM_ABERTO },
      _sum: { totalFinal: true },
      _count: { id: true },
    });

    // Vencidos: EM_ABERTO com dataVencimento < hoje
    const vencidos = await this.prisma.pedido.aggregate({
      where: {
        ...whereBase,
        statusPagamento: StatusPagamento.EM_ABERTO,
        dataVencimento: { lt: new Date() },
      },
      _sum: { totalFinal: true },
      _count: { id: true },
    });

    // A vencer nos próximos 7 dias
    const proximos7 = new Date();
    proximos7.setDate(proximos7.getDate() + 7);
    const aVencer = await this.prisma.pedido.aggregate({
      where: {
        ...whereBase,
        statusPagamento: StatusPagamento.EM_ABERTO,
        dataVencimento: { gte: new Date(), lte: proximos7 },
      },
      _sum: { totalFinal: true },
      _count: { id: true },
    });

    return {
      recebido: { total: Number(recebidos._sum.totalFinal ?? 0), qtd: recebidos._count.id },
      emAberto: { total: Number(emAberto._sum.totalFinal ?? 0), qtd: emAberto._count.id },
      vencido: { total: Number(vencidos._sum.totalFinal ?? 0), qtd: vencidos._count.id },
      aVencer7dias: { total: Number(aVencer._sum.totalFinal ?? 0), qtd: aVencer._count.id },
    };
  }

  // Listagem de contas a receber com filtros
  async contasAReceber(filtros: {
    vendedorId?: string;
    clienteId?: string;
    formaPagamento?: FormaPagamento;
    situacao?: 'EM_ABERTO' | 'VENCIDO' | 'PAGO' | 'A_VENCER';
    dataInicio?: string;
    dataFim?: string;
  }) {
    const where: any = {
      status: { notIn: [StatusPedido.RASCUNHO, StatusPedido.CANCELADO] },
    };

    if (filtros.vendedorId) where.vendedorId = filtros.vendedorId;
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    if (filtros.formaPagamento) where.formaPagamento = filtros.formaPagamento;

    if (filtros.dataInicio || filtros.dataFim) {
      where.data = {};
      if (filtros.dataInicio) where.data.gte = new Date(filtros.dataInicio);
      if (filtros.dataFim) {
        const fim = new Date(filtros.dataFim);
        fim.setHours(23, 59, 59, 999);
        where.data.lte = fim;
      }
    }

    // Filtro por situação
    if (filtros.situacao === 'PAGO') {
      where.statusPagamento = StatusPagamento.PAGO;
    } else if (filtros.situacao === 'VENCIDO') {
      where.statusPagamento = StatusPagamento.EM_ABERTO;
      where.dataVencimento = { lt: new Date() };
    } else if (filtros.situacao === 'A_VENCER') {
      const proximos7 = new Date();
      proximos7.setDate(proximos7.getDate() + 7);
      where.statusPagamento = StatusPagamento.EM_ABERTO;
      where.dataVencimento = { gte: new Date(), lte: proximos7 };
    } else if (filtros.situacao === 'EM_ABERTO') {
      where.statusPagamento = StatusPagamento.EM_ABERTO;
    }

    const pedidos = await this.prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { razaoSocialOuNome: true, nomeFantasia: true, telefone: true } },
        vendedor: { select: { nome: true } },
      },
      orderBy: [{ statusPagamento: 'asc' }, { dataVencimento: 'asc' }, { data: 'desc' }],
    });

    // Enriquece com situação calculada
    return pedidos.map((p) => {
      let situacao: string = p.statusPagamento;
      if (p.statusPagamento === StatusPagamento.EM_ABERTO && p.dataVencimento) {
        const venc = new Date(p.dataVencimento);
        const hoje = new Date();
        const proximos7 = new Date(); proximos7.setDate(hoje.getDate() + 7);
        if (venc < hoje) situacao = 'VENCIDO';
        else if (venc <= proximos7) situacao = 'A_VENCER';
      }
      return { ...p, situacaoCalculada: situacao };
    });
  }

  async reabrir(pedidoId: string, usuarioId: string) {
    const [pedido] = await this.prisma.$transaction([
      this.prisma.pedido.update({
        where: { id: pedidoId },
        data: { statusPagamento: StatusPagamento.EM_ABERTO },
      }),
      this.prisma.logAuditoria.create({
        data: { usuarioId, acao: 'REABRIR_PAGAMENTO', entidade: 'Pedido', entidadeId: pedidoId },
      }),
    ]);
    return pedido;
  }

  async marcarPago(pedidoId: string, usuarioId: string) {
    const [pedido] = await this.prisma.$transaction([
      this.prisma.pedido.update({
        where: { id: pedidoId },
        data: { statusPagamento: StatusPagamento.PAGO, status: StatusPedido.PAGO },
      }),
      this.prisma.logAuditoria.create({
        data: { usuarioId, acao: 'MARCAR_PAGO', entidade: 'Pedido', entidadeId: pedidoId },
      }),
    ]);
    return pedido;
  }
}
