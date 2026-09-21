import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

  // Compra a prazo = por pedido inteiro. Saldo devedor = totalFinal - soma dos pagamentos registrados
  private calcularSaldo(pedido: { totalFinal: any; pagamentos: { valor: any }[] }) {
    const valorPago = pedido.pagamentos.reduce((acc, p) => acc + Number(p.valor), 0);
    const saldoDevedor = Number((Number(pedido.totalFinal) - valorPago).toFixed(2));
    return { valorPago: Number(valorPago.toFixed(2)), saldoDevedor: Math.max(0, saldoDevedor) };
  }

  // KPIs do painel financeiro
  async resumo(dataInicio?: string, dataFim?: string) {
    const whereBase: any = {
      status: { notIn: [StatusPedido.CANCELADO, StatusPedido.REJEITADO] },
    };

    const periodoData: any = {};
    if (dataInicio) periodoData.gte = new Date(dataInicio);
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      periodoData.lte = fim;
    }

    // Total recebido no período = soma dos pagamentos (totais ou parciais) registrados no período
    const recebidos = await this.prisma.pagamentoPedido.aggregate({
      where: {
        ...(Object.keys(periodoData).length ? { data: periodoData } : {}),
        pedido: whereBase,
      },
      _sum: { valor: true },
      _count: { id: true },
    });

    // Pedidos com pendência (EM_ABERTO), considerando saldo devedor real (após pagamentos parciais)
    const pendentes = await this.prisma.pedido.findMany({
      where: { ...whereBase, statusPagamento: StatusPagamento.EM_ABERTO },
      select: {
        totalFinal: true,
        dataVencimento: true,
        pagamentos: { select: { valor: true } },
      },
    });

    const hoje = new Date();
    const proximos7 = new Date();
    proximos7.setDate(hoje.getDate() + 7);

    let emAbertoTotal = 0;
    let emAbertoQtd = 0;
    let vencidoTotal = 0;
    let vencidoQtd = 0;
    let aVencerTotal = 0;
    let aVencerQtd = 0;

    for (const pedido of pendentes) {
      const { saldoDevedor } = this.calcularSaldo(pedido);
      if (saldoDevedor <= 0) continue; // quitado por pagamentos parciais somados

      emAbertoTotal += saldoDevedor;
      emAbertoQtd += 1;

      if (pedido.dataVencimento && new Date(pedido.dataVencimento) < hoje) {
        vencidoTotal += saldoDevedor;
        vencidoQtd += 1;
      } else if (
        pedido.dataVencimento &&
        new Date(pedido.dataVencimento) >= hoje &&
        new Date(pedido.dataVencimento) <= proximos7
      ) {
        aVencerTotal += saldoDevedor;
        aVencerQtd += 1;
      }
    }

    return {
      recebido: { total: Number(recebidos._sum.valor ?? 0), qtd: recebidos._count.id },
      emAberto: { total: Number(emAbertoTotal.toFixed(2)), qtd: emAbertoQtd },
      vencido: { total: Number(vencidoTotal.toFixed(2)), qtd: vencidoQtd },
      aVencer7dias: { total: Number(aVencerTotal.toFixed(2)), qtd: aVencerQtd },
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
      status: { notIn: [StatusPedido.CANCELADO, StatusPedido.REJEITADO] },
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
        pagamentos: { orderBy: { data: 'asc' } },
      },
      orderBy: [{ statusPagamento: 'asc' }, { dataVencimento: 'asc' }, { data: 'desc' }],
    });

    // Enriquece com situação calculada e saldo devedor (considera pagamentos parciais)
    return pedidos.map((p) => {
      let situacao: string = p.statusPagamento;
      if (p.statusPagamento === StatusPagamento.EM_ABERTO && p.dataVencimento) {
        const venc = new Date(p.dataVencimento);
        const hoje = new Date();
        const proximos7 = new Date();
        proximos7.setDate(hoje.getDate() + 7);
        if (venc < hoje) situacao = 'VENCIDO';
        else if (venc <= proximos7) situacao = 'A_VENCER';
      }
      const { valorPago, saldoDevedor } = this.calcularSaldo(p);
      return { ...p, situacaoCalculada: situacao, valorPago, saldoDevedor };
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

  // Registra um pagamento (total ou parcial) de um pedido a prazo.
  // O saldo devedor é sempre recalculado a partir da soma de todos os pagamentos.
  async registrarPagamento(
    pedidoId: string,
    dto: { valor: number; formaPagamento?: FormaPagamento; observacao?: string },
    usuarioId: string,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagamentos: true },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.statusPagamento === StatusPagamento.PAGO) {
      throw new BadRequestException('Este pedido já está quitado');
    }

    const valor = Number(dto.valor);
    if (!valor || valor <= 0) {
      throw new BadRequestException('Informe um valor de pagamento válido');
    }

    const { saldoDevedor } = this.calcularSaldo(pedido);
    if (valor > saldoDevedor + 0.01) {
      throw new BadRequestException(
        `Valor informado (${valor.toFixed(2)}) é maior que o saldo devedor (${saldoDevedor.toFixed(2)})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const pagamento = await tx.pagamentoPedido.create({
        data: {
          pedidoId,
          valor,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao,
          usuarioId,
        },
      });

      const novoSaldo = Number((saldoDevedor - valor).toFixed(2));
      const quitado = novoSaldo <= 0.01;

      const pedidoAtualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: { statusPagamento: quitado ? StatusPagamento.PAGO : StatusPagamento.EM_ABERTO },
      });

      // Pedido quitado (mesmo que por soma de pagamentos parciais): encerra notificações de cobrança ativas
      if (quitado) {
        await tx.notificacaoCliente.updateMany({
          where: { pedidoId, status: { in: ['PENDENTE', 'ENVIADA'] } },
          data: { status: 'CANCELADA' },
        });
      }

      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'REGISTRAR_PAGAMENTO',
          entidade: 'Pedido',
          entidadeId: pedidoId,
          detalhes: { valor, saldoRestante: Math.max(0, novoSaldo) },
        },
      });

      return { pedido: pedidoAtualizado, pagamento, saldoDevedor: Math.max(0, novoSaldo) };
    });
  }

  // Quitação total de uma vez: registra o saldo devedor restante como pagamento
  async marcarPago(pedidoId: string, usuarioId: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagamentos: true },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.statusPagamento === StatusPagamento.PAGO) return pedido;

    const { saldoDevedor } = this.calcularSaldo(pedido);
    if (saldoDevedor <= 0) {
      const [atualizado] = await this.prisma.$transaction([
        this.prisma.pedido.update({
          where: { id: pedidoId },
          data: { statusPagamento: StatusPagamento.PAGO },
        }),
        this.prisma.logAuditoria.create({
          data: { usuarioId, acao: 'MARCAR_PAGO', entidade: 'Pedido', entidadeId: pedidoId },
        }),
      ]);
      return atualizado;
    }

    const { pedido: atualizado } = await this.registrarPagamento(
      pedidoId,
      { valor: saldoDevedor, formaPagamento: pedido.formaPagamento, observacao: 'Quitação total' },
      usuarioId,
    );
    return atualizado;
  }

  // Roda todo dia às 8h e cobre a regra: 3 dias antes do vencimento + no dia do vencimento,
  // sempre considerando o saldo devedor (não o valor original do pedido)
  @Cron('0 8 * * *')
  async executarNotificacoesDiarias() {
    return this.gerarNotificacoesVencimento();
  }

  async gerarNotificacoesVencimento() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        statusPagamento: StatusPagamento.EM_ABERTO,
        dataVencimento: { not: null },
      },
      include: {
        cliente: { select: { id: true, razaoSocialOuNome: true, email: true, whatsapp: true } },
        pagamentos: { select: { valor: true } },
      },
      orderBy: { dataVencimento: 'asc' },
    });

    const notificacoes: any[] = [];
    const formatarBRL = (valor: number) =>
      valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    for (const pedido of pedidos) {
      if (!pedido.cliente || !pedido.dataVencimento) continue;

      // Pagamento parcial já identificado: notifica apenas sobre o saldo restante
      const { saldoDevedor } = this.calcularSaldo(pedido);
      if (saldoDevedor <= 0) continue;
      const saldoFormatado = formatarBRL(saldoDevedor);

      const vencimento = new Date(pedido.dataVencimento);
      const diffDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / 86400000);
      const tipos: Array<{ tipo: string; titulo: string; mensagem: string; agendadaPara: Date }> =
        [];

      if (diffDias <= 0) {
        tipos.push({
          tipo: 'VENCIMENTO_HOJE',
          titulo: 'Pedido vencido',
          mensagem: `O pedido ${pedido.numero} de ${pedido.cliente.razaoSocialOuNome} está vencido. Saldo em aberto: ${saldoFormatado}.`,
          agendadaPara: vencimento,
        });
      }

      if (diffDias === 3) {
        tipos.push({
          tipo: 'VENCE_EM_3_DIAS',
          titulo: 'Pagamento próximo do vencimento',
          mensagem: `Faltam 3 dias para o vencimento do pedido ${pedido.numero} de ${pedido.cliente.razaoSocialOuNome}. Saldo em aberto: ${saldoFormatado}.`,
          agendadaPara: vencimento,
        });
      }

      if (tipos.length === 0) continue;

      for (const item of tipos) {
        const existente = await this.prisma.notificacaoCliente.findFirst({
          where: {
            clienteId: pedido.clienteId,
            pedidoId: pedido.id,
            tipo: item.tipo,
            status: { in: ['PENDENTE', 'ENVIADA'] },
          },
        });

        if (existente) continue;

        const criada = await this.prisma.notificacaoCliente.create({
          data: {
            clienteId: pedido.clienteId,
            pedidoId: pedido.id,
            tipo: item.tipo,
            titulo: item.titulo,
            mensagem: item.mensagem,
            agendadaPara: item.agendadaPara,
            status: 'PENDENTE',
          },
        });

        notificacoes.push(criada);
      }
    }

    return notificacoes;
  }
}
