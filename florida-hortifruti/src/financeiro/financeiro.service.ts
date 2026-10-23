import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { StatusPedido, StatusPagamento, FormaPagamento, PapelUsuario } from '@prisma/client';
import { dataEfetiva } from '../common/data-efetiva';
import { hojeBrasilia, montarAvisoCobranca, TipoAvisoCobranca } from './avisos-cobranca.util';
import { TIPO_PEDIDO_A_CAMINHO } from '../notificacoes/notificacoes.service';

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
    dto: { valor: number; formaPagamento?: FormaPagamento; observacao?: string; data?: string },
    usuarioId: string,
    papel?: PapelUsuario,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagamentos: true },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    this.validarResponsavel(pedido, usuarioId, papel);
    const dataPagamento = dataEfetiva(dto.data, 'Data do pagamento');
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
    // Pagamento parcial fica com o financeiro e o supervisor; o vendedor só registra a quitação
    if (papel === PapelUsuario.VENDEDOR && valor < saldoDevedor - 0.01) {
      throw new ForbiddenException('Vendedor registra apenas o pagamento total do pedido');
    }

    return this.prisma.$transaction(async (tx) => {
      const pagamento = await tx.pagamentoPedido.create({
        data: {
          pedidoId,
          valor,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao,
          data: dataPagamento,
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
          detalhes: {
            valor,
            saldoRestante: Math.max(0, novoSaldo),
            dataPagamento: dataPagamento.toISOString(),
          },
        },
      });

      return { pedido: pedidoAtualizado, pagamento, saldoDevedor: Math.max(0, novoSaldo) };
    });
  }

  // Vendedor só mexe no pagamento dos próprios pedidos; supervisor e financeiro, em todos
  private validarResponsavel(
    pedido: { vendedorId: string | null },
    usuarioId: string,
    papel?: PapelUsuario,
  ) {
    if (papel === PapelUsuario.VENDEDOR && pedido.vendedorId !== usuarioId) {
      throw new ForbiddenException('Você só pode registrar pagamento dos seus pedidos');
    }
  }

  // Quitação total de uma vez: registra o saldo devedor restante como pagamento
  async marcarPago(pedidoId: string, usuarioId: string, papel?: PapelUsuario, data?: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { pagamentos: true },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    this.validarResponsavel(pedido, usuarioId, papel);
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
      {
        valor: saldoDevedor,
        formaPagamento: pedido.formaPagamento,
        observacao: 'Quitação total',
        data,
      },
      usuarioId,
      papel,
    );
    return atualizado;
  }

  // Roda todo dia às 8h (Brasília): 3 dias antes do vencimento + no dia do vencimento,
  // sempre considerando o saldo devedor (não o valor original do pedido)
  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async executarNotificacoesDiarias() {
    return this.gerarNotificacoesVencimento();
  }

  async gerarNotificacoesVencimento() {
    const hoje = hojeBrasilia();

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        statusPagamento: StatusPagamento.EM_ABERTO,
        dataVencimento: { not: null },
        status: {
          notIn: [
            StatusPedido.CANCELADO,
            StatusPedido.REJEITADO,
            StatusPedido.AGUARDANDO_APROVACAO,
          ],
        },
      },
      include: {
        cliente: { select: { id: true, razaoSocialOuNome: true } },
        pagamentos: { select: { valor: true } },
      },
      orderBy: { dataVencimento: 'asc' },
    });

    const notificacoes: any[] = [];

    for (const pedido of pedidos) {
      if (!pedido.cliente || !pedido.dataVencimento) continue;

      // Pagamento parcial já identificado: notifica apenas sobre o saldo restante
      const { saldoDevedor } = this.calcularSaldo(pedido);
      if (saldoDevedor <= 0) continue;

      const vencimento = new Date(pedido.dataVencimento);
      const diffDias = Math.round((vencimento.getTime() - hoje.getTime()) / 86400000);
      let tipo: TipoAvisoCobranca | null = null;
      if (diffDias <= 0) tipo = 'VENCIMENTO_HOJE';
      else if (diffDias === 3) tipo = 'VENCE_EM_3_DIAS';
      if (!tipo) continue;

      const existente = await this.prisma.notificacaoCliente.findFirst({
        where: {
          clienteId: pedido.clienteId,
          pedidoId: pedido.id,
          tipo,
          status: { in: ['PENDENTE', 'ENVIADA'] },
        },
      });
      if (existente) continue;

      const { titulo, mensagem } = montarAvisoCobranca(tipo, {
        numeroPedido: pedido.numero,
        valor: saldoDevedor,
        vencimento,
        vencido: diffDias < 0,
      });

      const criada = await this.prisma.notificacaoCliente.create({
        data: {
          clienteId: pedido.clienteId,
          pedidoId: pedido.id,
          tipo,
          titulo,
          mensagem,
          agendadaPara: vencimento,
          status: 'PENDENTE',
        },
      });

      notificacoes.push(criada);
    }

    return notificacoes;
  }

  // Avisos de cobrança para a equipe acompanhar e mandar pelo WhatsApp
  async listarNotificacoes(filtros: { status?: string; clienteId?: string }) {
    const notificacoes = await this.prisma.notificacaoCliente.findMany({
      where: {
        // "Pedido a caminho" já sai automático (portal + push); aqui só cobrança
        tipo: { not: TIPO_PEDIDO_A_CAMINHO },
        ...(filtros.status ? { status: filtros.status } : {}),
        ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      },
      include: {
        cliente: { select: { id: true, razaoSocialOuNome: true, whatsapp: true, telefone: true } },
        pedido: { select: { id: true, numero: true, dataVencimento: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: 300,
    });
    return notificacoes;
  }

  async marcarNotificacaoEnviada(id: string) {
    const notificacao = await this.prisma.notificacaoCliente.findUnique({ where: { id } });
    if (!notificacao) throw new NotFoundException('Aviso não encontrado');
    if (notificacao.status === 'CANCELADA') {
      throw new BadRequestException('Aviso cancelado: o pedido já foi pago');
    }
    return this.prisma.notificacaoCliente.update({
      where: { id },
      data: { status: 'ENVIADA', enviadaEm: new Date() },
    });
  }
}
