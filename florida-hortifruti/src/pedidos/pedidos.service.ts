import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { EtiquetasService } from '../etiquetas/etiquetas.service';
import { CreatePedidoDto, UpdatePedidoDto, FiltrosPedidoDto } from './dto/pedido.dto';
import { PapelUsuario, StatusPedido, TipoMovimentacao } from '@prisma/client';

@Injectable()
export class PedidosService {
  constructor(
    private prisma: PrismaService,
    private estoqueService: EstoqueService,
    private etiquetasService: EtiquetasService,
  ) {}

  private async validarEstoque(itens: { produtoId: string; quantidade: number }[]) {
    const porProduto = new Map<string, number>();
    for (const item of itens) {
      porProduto.set(
        item.produtoId,
        (porProduto.get(item.produtoId) ?? 0) + Number(item.quantidade),
      );
    }

    const ids = [...porProduto.keys()];
    const produtos = await this.prisma.produto.findMany({ where: { id: { in: ids } } });
    const faltando: string[] = [];

    for (const [produtoId, quantidade] of porProduto) {
      const saldo = Number(await this.estoqueService.saldoAtual(produtoId));
      if (saldo < quantidade) {
        const nome = produtos.find((p) => p.id === produtoId)?.nome ?? produtoId;
        faltando.push(`${nome} (pedido ${quantidade} cx, estoque ${saldo} cx)`);
      }
    }

    if (faltando.length > 0) {
      throw new BadRequestException(`Sem estoque suficiente: ${faltando.join('; ')}`);
    }
  }

  // Itens 6, 7 e 8 do escopo: cálculo automático de subtotal, frete, desconto e total
  async create(dto: CreatePedidoDto, vendedorId: string) {
    await this.validarEstoque(dto.itens);
    const itensCalculados = dto.itens.map((item) => ({
      ...item,
      valorTotal: item.quantidade * item.valorUnitario,
    }));

    const subtotal = itensCalculados.reduce((acc, i) => acc + i.valorTotal, 0);
    const frete = dto.valorFrete ?? 0;
    const desconto =
      dto.descontoValor ?? (dto.descontoPercentual ? (subtotal * dto.descontoPercentual) / 100 : 0);
    const totalFinal = subtotal + frete - desconto;

    return this.prisma.pedido.create({
      data: {
        clienteId: dto.clienteId,
        vendedorId,
        status: StatusPedido.ENVIADO,
        subtotal,
        valorFrete: frete,
        freteInclusoNoPreco: dto.freteInclusoNoPreco ?? false,
        descontoValor: desconto,
        descontoPercentual: dto.descontoPercentual,
        totalFinal,
        formaPagamento: dto.formaPagamento,
        dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : undefined,
        condicaoNegociada: dto.condicaoNegociada,
        necessitaNF: dto.necessitaNF ?? false,
        observacoes: dto.observacoes,
        itens: {
          create: itensCalculados.map((i) => ({
            produtoId: i.produtoId,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.valorTotal,
          })),
        },
      },
      include: { itens: true },
    });
  }

  // Seção 19 do escopo: filtros por data, cliente, vendedor, status, forma de pagamento
  // Seção 3.1: vendedor só vê os próprios pedidos
  findAll(filtros: FiltrosPedidoDto = {}, usuarioId?: string, papel?: PapelUsuario) {
    const where: any = {};

    if (papel === PapelUsuario.VENDEDOR) {
      where.vendedorId = usuarioId;
    } else if (filtros.vendedorId) {
      where.vendedorId = filtros.vendedorId;
    }

    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    if (filtros.status) where.status = filtros.status;
    if (filtros.formaPagamento) where.formaPagamento = filtros.formaPagamento;
    if (filtros.necessitaNF !== undefined) where.necessitaNF = filtros.necessitaNF;

    if (filtros.dataInicio || filtros.dataFim) {
      where.data = {};
      if (filtros.dataInicio) where.data.gte = new Date(filtros.dataInicio);
      if (filtros.dataFim) where.data.lte = new Date(filtros.dataFim);
    }

    return this.prisma.pedido.findMany({
      where,
      include: {
        cliente: true,
        vendedor: true,
        itens: { include: { produto: true } },
        etiqueta: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string, usuarioId?: string, papel?: PapelUsuario) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: true,
        itens: { include: { produto: true } },
        etiqueta: true,
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (papel === PapelUsuario.VENDEDOR && pedido.vendedorId !== usuarioId) {
      throw new ForbiddenException('Você não tem acesso a este pedido');
    }
    return pedido;
  }

  // Seção 3.2: administrativo pode editar pedido antes de aprovar (status ENVIADO ou EM_CONFERENCIA)
  async atualizar(id: string, dto: UpdatePedidoDto, usuarioId: string) {
    const pedido = await this.findOne(id);

    if (pedido.status === StatusPedido.APROVADO || pedido.status === StatusPedido.CANCELADO) {
      throw new BadRequestException('Não é possível editar pedido neste status');
    }

    const itens =
      dto.itens ??
      pedido.itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: Number(i.quantidade),
        valorUnitario: Number(i.valorUnitario),
      }));

    await this.validarEstoque(itens);
    const itensCalculados = itens.map((i) => ({
      ...i,
      valorTotal: i.quantidade * i.valorUnitario,
    }));
    const subtotal = itensCalculados.reduce((acc, i) => acc + i.valorTotal, 0);
    const frete = dto.valorFrete ?? Number(pedido.valorFrete);
    const desconto =
      dto.descontoValor ??
      (dto.descontoPercentual
        ? (subtotal * dto.descontoPercentual) / 100
        : Number(pedido.descontoValor));
    const totalFinal = subtotal + frete - desconto;

    return this.prisma.$transaction(async (tx) => {
      if (dto.itens) {
        await tx.itemPedido.deleteMany({ where: { pedidoId: id } });
        await tx.itemPedido.createMany({
          data: itensCalculados.map((i) => ({ pedidoId: id, ...i })),
        });
      }

      const pedidoAtualizado = await tx.pedido.update({
        where: { id },
        data: {
          ...(dto.clienteId && { clienteId: dto.clienteId }),
          subtotal,
          valorFrete: frete,
          freteInclusoNoPreco: dto.freteInclusoNoPreco ?? pedido.freteInclusoNoPreco,
          descontoValor: desconto,
          descontoPercentual: dto.descontoPercentual,
          totalFinal,
          formaPagamento: dto.formaPagamento ?? pedido.formaPagamento,
          dataVencimento: dto.dataVencimento ? new Date(dto.dataVencimento) : pedido.dataVencimento,
          condicaoNegociada: dto.condicaoNegociada ?? pedido.condicaoNegociada,
          necessitaNF: dto.necessitaNF ?? pedido.necessitaNF,
          observacoes: dto.observacoes ?? pedido.observacoes,
        },
        include: { itens: { include: { produto: true } }, cliente: true, vendedor: true },
      });

      await tx.logAuditoria.create({
        data: { usuarioId, acao: 'EDITAR_PEDIDO', entidade: 'Pedido', entidadeId: id },
      });

      return pedidoAtualizado;
    });
  }

  // Fluxo do item 34.5: pedido aprovado -> saída de estoque -> etiqueta gerada -> QR vinculado
  // Tudo dentro de uma $transaction para garantir atomicidade
  async aprovar(id: string, usuarioId: string) {
    const pedido = await this.findOne(id);

    if (pedido.status !== StatusPedido.ENVIADO && pedido.status !== StatusPedido.EM_CONFERENCIA) {
      throw new BadRequestException(
        `Pedido não pode ser aprovado no status atual: ${pedido.status}`,
      );
    }

    await this.validarEstoque(
      pedido.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: Number(item.quantidade),
      })),
    );

    const saidasEstoque = pedido.itens.map((item) => ({
      produtoId: item.produtoId,
      tipo: TipoMovimentacao.SAIDA,
      quantidade: -Math.abs(Number(item.quantidade)),
      origem: `Pedido ${pedido.numero}`,
      pedidoId: pedido.id,
      usuarioId,
    }));

    const [pedidoAprovado] = await this.prisma.$transaction([
      this.prisma.pedido.update({ where: { id }, data: { status: StatusPedido.APROVADO } }),
      ...saidasEstoque.map((s) => this.prisma.movimentacaoEstoque.create({ data: s })),
      this.prisma.etiqueta.create({ data: { pedidoId: id } }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'APROVAR_PEDIDO',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: { numeroPedido: pedido.numero, totalFinal: pedido.totalFinal },
        },
      }),
    ]);

    const etiqueta = await this.prisma.etiqueta.findUnique({ where: { pedidoId: id } });
    return { pedido: pedidoAprovado, etiqueta };
  }

  async atualizarStatus(id: string, novoStatus: StatusPedido, usuarioId: string) {
    await this.findOne(id);
    const [pedido] = await this.prisma.$transaction([
      this.prisma.pedido.update({ where: { id }, data: { status: novoStatus } }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId,
          acao: `STATUS_${novoStatus}`,
          entidade: 'Pedido',
          entidadeId: id,
        },
      }),
    ]);
    return pedido;
  }

  // Regra 6 do escopo: cancelamento não apaga o pedido, só muda o status
  cancelar(id: string, usuarioId: string) {
    return this.atualizarStatus(id, StatusPedido.CANCELADO, usuarioId);
  }
}
