import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { EtiquetasService } from '../etiquetas/etiquetas.service';
import {
  CreatePedidoDto,
  UpdatePedidoDto,
  FiltrosPedidoDto,
  CriarSolicitacaoAlteracaoDto,
  MarcarEntregueDto,
  AtribuirPedidoDto,
  RejeitarPedidoDto,
} from './dto/pedido.dto';
import {
  OrigemPedido,
  PapelUsuario,
  Prisma,
  StatusPagamento,
  StatusPedido,
  StatusSolicitacaoAlteracao,
  TipoMovimentacao,
} from '@prisma/client';
import { StorageService } from '../common/storage.service';
import { dataEfetiva } from '../common/data-efetiva';
import { registrarHistoricoStatus } from './historico-status.util';
import { montarAvisoCobranca } from '../financeiro/avisos-cobranca.util';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

@Injectable()
export class PedidosService {
  constructor(
    private prisma: PrismaService,
    private estoqueService: EstoqueService,
    private etiquetasService: EtiquetasService,
    private storage: StorageService,
    private notificacoes: NotificacoesService,
  ) {}

  private readonly statusAposAprovacao: StatusPedido[] = [
    StatusPedido.APROVADO,
    StatusPedido.EM_SEPARACAO,
    StatusPedido.PRONTO_PARA_ENTREGA,
    StatusPedido.EM_ENTREGA,
    StatusPedido.ENTREGUE,
  ];

  private readonly statusPodeSolicitar: StatusPedido[] = [
    StatusPedido.APROVADO,
    StatusPedido.EM_SEPARACAO,
    StatusPedido.PRONTO_PARA_ENTREGA,
  ];

  private readonly statusPodeEntregar: StatusPedido[] = [
    StatusPedido.APROVADO,
    StatusPedido.EM_SEPARACAO,
    StatusPedido.PRONTO_PARA_ENTREGA,
    StatusPedido.EM_ENTREGA,
  ];

  private async validarEstoque(
    itens: { produtoId: string; quantidade: number; loteId?: string | null }[],
  ) {
    await this.estoqueService.validarDisponibilidade(itens);
  }

  // Itens 6, 7 e 8 do escopo: cálculo automático de subtotal, frete, desconto e total
  async create(
    dto: CreatePedidoDto,
    vendedorId: string | null,
    opts: { origem?: OrigemPedido; clienteId?: string } = {},
  ) {
    this.validarLotesRepetidos(dto.itens);
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
    const origem = opts.origem ?? OrigemPedido.VENDEDOR;
    const clienteId = opts.clienteId ?? dto.clienteId;

    const pedido = await this.prisma.pedido.create({
      data: {
        clienteId,
        vendedorId: origem === OrigemPedido.VENDEDOR ? vendedorId : vendedorId,
        origem,
        data: dataEfetiva(dto.data, 'Data do pedido'),
        status: StatusPedido.AGUARDANDO_APROVACAO,
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
            loteId: i.loteId || null,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.valorTotal,
          })),
        },
      },
      include: { itens: true },
    });
    await registrarHistoricoStatus(this.prisma, pedido.id, StatusPedido.AGUARDANDO_APROVACAO);
    return pedido;
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

    return this.prisma.pedido
      .findMany({
        where,
        include: {
          cliente: true,
          vendedor: true,
          entregador: { select: { id: true, nome: true } },
          itens: {
            include: { produto: true, lote: { select: { numero: true, dataEntrada: true } } },
          },
          etiqueta: true,
          comprovanteEntrega: true,
          // Saldo em aberto no detalhe do pedido (registrar pagamento)
          pagamentos: { select: { valor: true, data: true }, orderBy: { data: 'asc' } },
          solicitacoesAlteracao: {
            where: { status: StatusSolicitacaoAlteracao.PENDENTE },
            select: { id: true },
            take: 1,
          },
        },
        // Pela data da venda (pode ser anterior ao cadastro); no mesmo dia, o mais recente primeiro
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
      })
      .then((pedidos) => pedidos.map((p) => this.marcarAguardandoAlteracao(p)));
  }

  async findOne(id: string, usuarioId?: string, papel?: PapelUsuario) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: true,
        entregador: { select: { id: true, nome: true } },
        itens: {
          include: {
            produto: { include: { categoria: true } },
            lote: { select: { numero: true, dataEntrada: true } },
          },
        },
        etiqueta: true,
        comprovanteEntrega: true,
        pagamentos: { select: { valor: true, data: true }, orderBy: { data: 'asc' } },
        solicitacoesAlteracao: {
          include: { solicitante: { select: { id: true, nome: true } } },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (papel === PapelUsuario.VENDEDOR && pedido.vendedorId !== usuarioId) {
      throw new ForbiddenException('Você não tem acesso a este pedido');
    }

    const logsDevolucao = await this.prisma.logAuditoria.findMany({
      where: { acao: 'REGISTRAR_DEVOLUCAO', entidadeId: id },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { data: 'desc' },
    });

    const devolucoes = logsDevolucao.map((log) => {
      const detalhes = this.lerDetalhesDevolucao(log.detalhes as Prisma.JsonValue | null);
      return {
        id: log.id,
        data: log.data,
        status: detalhes.status,
        etiquetaToken: detalhes.etiquetaToken,
        itens: detalhes.itens,
        itensDevolvidos: detalhes.itensDevolvidos,
        quantidadeCaixas: detalhes.quantidadeCaixas,
        valorDevolucao: detalhes.valorDevolucao,
        observacao: detalhes.observacao,
        resposta: detalhes.resposta,
        fotos: detalhes.fotos,
        registradoPor: log.usuario?.nome ?? null,
      };
    });

    return this.marcarAguardandoAlteracao({ ...pedido, devolucoes });
  }

  async rastreioLotes(id: string, usuarioId?: string, papel?: PapelUsuario) {
    await this.findOne(id, usuarioId, papel);
    return this.estoqueService.lotesUtilizadosNoPedido(id);
  }

  private lerDetalhesDevolucao(raw: Prisma.JsonValue | null) {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    const itens = Array.isArray(obj.itens)
      ? obj.itens
          .map((item: any) => ({
            produtoId: String(item?.produtoId ?? ''),
            nome: String(item?.nome ?? ''),
            quantidade: Number(item?.quantidade ?? 0),
            valorUnitario: Number(item?.valorUnitario ?? 0),
            valorTotal: Number(item?.valorTotal ?? 0),
          }))
          .filter((item: any) => item.produtoId && item.quantidade > 0)
      : [];

    return {
      status:
        obj.status === 'CONCLUIDA' || obj.status === 'NEGADA' ? String(obj.status) : 'PENDENTE',
      etiquetaToken: obj.etiquetaToken ? String(obj.etiquetaToken) : null,
      itens,
      itensDevolvidos: obj.itensDevolvidos ? String(obj.itensDevolvidos) : null,
      quantidadeCaixas:
        typeof obj.quantidadeCaixas === 'number' && Number.isFinite(obj.quantidadeCaixas)
          ? Number(obj.quantidadeCaixas)
          : null,
      valorDevolucao:
        typeof obj.valorDevolucao === 'number' && Number.isFinite(obj.valorDevolucao)
          ? Number(obj.valorDevolucao)
          : null,
      observacao: obj.observacao ? String(obj.observacao) : null,
      resposta: obj.resposta ? String(obj.resposta) : null,
      fotos: Array.isArray(obj.fotos) ? obj.fotos.map(String) : [],
    };
  }

  private marcarAguardandoAlteracao<
    T extends { solicitacoesAlteracao?: { id?: string; status?: string }[] },
  >(pedido: T) {
    const pendente = (pedido.solicitacoesAlteracao ?? []).some(
      (s) => !s.status || s.status === StatusSolicitacaoAlteracao.PENDENTE,
    );
    return { ...pedido, aguardandoAlteracao: pendente };
  }

  private statusBloqueadoParaEdicao(status: StatusPedido) {
    return (
      status === StatusPedido.CANCELADO ||
      status === StatusPedido.REJEITADO ||
      status === StatusPedido.ENTREGUE
    );
  }

  private estoqueJaBaixado(status: StatusPedido) {
    return this.statusAposAprovacao.includes(status);
  }

  // Edições que não informam o lote mantêm o lote anterior, quando o produto tinha um só lote
  private manterLotes<T extends { produtoId: string; loteId?: string | null }>(
    antigos: { produtoId: string; loteId: string | null }[],
    novos: T[],
  ) {
    const lotePorProduto = new Map<string, string | null>();
    const repetidos = new Set<string>();
    for (const i of antigos) {
      if (lotePorProduto.has(i.produtoId)) repetidos.add(i.produtoId);
      lotePorProduto.set(i.produtoId, i.loteId);
    }
    return novos.map((i) => ({
      ...i,
      loteId:
        i.loteId !== undefined
          ? i.loteId || null
          : repetidos.has(i.produtoId)
            ? null
            : (lotePorProduto.get(i.produtoId) ?? null),
    }));
  }

  // Um produto pode ser dividido entre lotes, mas cada lote aparece uma vez por produto
  private validarLotesRepetidos(itens: { produtoId: string; loteId?: string | null }[]) {
    const vistos = new Set<string>();
    for (const item of itens) {
      if (!item.loteId) continue;
      const chave = `${item.produtoId}|${item.loteId}`;
      if (vistos.has(chave)) {
        throw new BadRequestException(
          'O mesmo lote foi escolhido duas vezes para o mesmo produto; junte as quantidades',
        );
      }
      vistos.add(chave);
    }
  }

  private chaveItem(item: { produtoId: string; loteId?: string | null }) {
    return `${item.produtoId}|${item.loteId ?? ''}`;
  }

  // Devolve ao estoque (produto e lote de origem) as caixas de um item do pedido
  private async devolverItemEmTx(
    tx: Prisma.TransactionClient,
    params: {
      pedidoId: string;
      produtoId: string;
      loteId: string | null;
      quantidade: number;
      origem: string;
      usuarioId: string;
    },
  ) {
    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        produtoId: params.produtoId,
        tipo: TipoMovimentacao.ENTRADA,
        quantidade: Math.abs(params.quantidade),
        origem: params.origem,
        pedidoId: params.pedidoId,
        usuarioId: params.usuarioId,
      },
    });
    await this.estoqueService.devolverDoPedidoEmTx(tx, {
      pedidoId: params.pedidoId,
      produtoId: params.produtoId,
      quantidade: Math.abs(params.quantidade),
      movimentacaoId: movimentacao.id,
      origem: params.origem,
      loteIdPreferido: params.loteId,
    });
  }

  // Baixa do produto e do lote escolhido para um item do pedido (nunca troca de lote sozinho)
  private async baixarItemEmTx(
    tx: Prisma.TransactionClient,
    params: {
      pedidoId: string;
      produtoId: string;
      produtoNome?: string;
      loteId: string | null;
      quantidade: number;
      valorUnitario: number;
      origem: string;
      usuarioId: string;
    },
  ) {
    if (!params.loteId) {
      throw new BadRequestException(
        `Selecione o lote de ${params.produtoNome ?? 'cada produto'} antes de continuar`,
      );
    }
    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        produtoId: params.produtoId,
        tipo: TipoMovimentacao.SAIDA,
        quantidade: -Math.abs(params.quantidade),
        origem: params.origem,
        pedidoId: params.pedidoId,
        usuarioId: params.usuarioId,
      },
    });
    await this.estoqueService.baixarLoteEmTx(tx, {
      loteId: params.loteId,
      produtoId: params.produtoId,
      quantidade: Math.abs(params.quantidade),
      movimentacaoId: movimentacao.id,
      origem: params.origem,
      pedidoId: params.pedidoId,
      valorUnitario: params.valorUnitario,
    });
  }

  private somarPorProduto(itens: { produtoId: string; quantidade: number }[]) {
    const mapa = new Map<string, number>();
    for (const item of itens) {
      mapa.set(item.produtoId, (mapa.get(item.produtoId) ?? 0) + Number(item.quantidade));
    }
    return mapa;
  }

  async atualizar(id: string, dto: UpdatePedidoDto, usuarioId: string, papel?: PapelUsuario) {
    const pedido = await this.findOne(id, usuarioId, papel);

    if (this.statusBloqueadoParaEdicao(pedido.status)) {
      throw new BadRequestException('Não é possível editar pedido neste status');
    }

    if (papel === PapelUsuario.VENDEDOR) {
      throw new ForbiddenException('Para alterar a quantidade, envie uma solicitação de alteração');
    }

    if (dto.itens && this.estoqueJaBaixado(pedido.status)) {
      throw new BadRequestException(
        'Após a aprovação, alterações de quantidade passam pela aba Solicitações de Alteração',
      );
    }

    const itensAntigos = pedido.itens.map((i) => ({
      produtoId: i.produtoId,
      quantidade: Number(i.quantidade),
    }));
    const itens = this.manterLotes(
      pedido.itens,
      dto.itens ??
        pedido.itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: Number(i.quantidade),
          valorUnitario: Number(i.valorUnitario),
        })),
    );

    if (itens.length === 0) {
      throw new BadRequestException('O pedido precisa ter pelo menos um produto');
    }
    this.validarLotesRepetidos(itens);
    if (itens.some((i) => Number(i.quantidade) <= 0)) {
      throw new BadRequestException('A quantidade de cada produto deve ser maior que zero');
    }

    const jaBaixou = this.estoqueJaBaixado(pedido.status);
    if (dto.itens) {
      if (jaBaixou) {
        const antigo = this.somarPorProduto(itensAntigos);
        const novo = this.somarPorProduto(itens);
        const extras: { produtoId: string; quantidade: number }[] = [];
        for (const [produtoId, quantidade] of novo) {
          const extra = quantidade - (antigo.get(produtoId) ?? 0);
          if (extra > 0) extras.push({ produtoId, quantidade: extra });
        }
        if (extras.length > 0) await this.validarEstoque(extras);
      } else {
        await this.validarEstoque(itens);
      }
    }

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

        if (jaBaixou) {
          const antigo = this.somarPorProduto(itensAntigos);
          const novo = this.somarPorProduto(itens);
          const ids = new Set([...antigo.keys(), ...novo.keys()]);
          for (const produtoId of ids) {
            const delta = (novo.get(produtoId) ?? 0) - (antigo.get(produtoId) ?? 0);
            if (delta === 0) continue;
            await tx.movimentacaoEstoque.create({
              data: {
                produtoId,
                tipo: delta > 0 ? TipoMovimentacao.SAIDA : TipoMovimentacao.ENTRADA,
                quantidade: delta > 0 ? -delta : Math.abs(delta),
                origem: `Ajuste pedido ${pedido.numero}`,
                pedidoId: id,
                usuarioId,
              },
            });
          }
        }
      }

      const pedidoAtualizado = await tx.pedido.update({
        where: { id },
        data: {
          ...(dto.clienteId ? { clienteId: dto.clienteId } : {}),
          ...(dto.data ? { data: dataEfetiva(dto.data, 'Data do pedido') } : {}),
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
        include: {
          itens: { include: { produto: true } },
          cliente: true,
          vendedor: true,
          etiqueta: true,
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'EDITAR_PEDIDO',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: dto.itens ? { itens: itensCalculados } : undefined,
        },
      });

      return pedidoAtualizado;
    });
  }

  // Fluxo do item 34.5: pedido aprovado -> saída de estoque -> etiqueta gerada -> QR vinculado
  // Tudo dentro de uma $transaction para garantir atomicidade
  async aprovar(id: string, usuarioId: string) {
    const pedido = await this.findOne(id);

    if (pedido.status !== StatusPedido.AGUARDANDO_APROVACAO) {
      throw new BadRequestException(
        `Pedido não pode ser aprovado no status atual: ${pedido.status}`,
      );
    }

    // A escolha do lote é sempre manual: sem lote em algum item, o pedido não é aprovado
    const semLote = pedido.itens.filter((item) => !item.loteId);
    if (semLote.length > 0) {
      throw new BadRequestException(
        `Selecione o lote antes de aprovar: ${semLote.map((i) => i.produto.nome).join(', ')}`,
      );
    }

    await this.validarEstoque(
      pedido.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: Number(item.quantidade),
        loteId: item.loteId,
      })),
    );

    const totalCaixas = pedido.itens.reduce(
      (acc, item) => acc + Math.round(Number(item.quantidade)),
      0,
    );

    const pedidoAprovado = await this.prisma.$transaction(async (tx) => {
      const pedidoAtualizado = await tx.pedido.update({
        where: { id },
        data: { status: StatusPedido.APROVADO, caixasEtiquetadas: Math.max(1, totalCaixas) },
      });

      for (const item of pedido.itens) {
        await this.baixarItemEmTx(tx, {
          pedidoId: pedido.id,
          produtoId: item.produtoId,
          produtoNome: item.produto.nome,
          loteId: item.loteId,
          quantidade: Number(item.quantidade),
          valorUnitario: Number(item.valorUnitario),
          origem: `Pedido ${pedido.numero}`,
          usuarioId,
        });
      }

      await tx.etiqueta.create({ data: { pedidoId: id } });
      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'APROVAR_PEDIDO',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: { numeroPedido: pedido.numero, totalFinal: pedido.totalFinal },
        },
      });
      await registrarHistoricoStatus(tx, id, StatusPedido.APROVADO);

      // Compra a prazo: avisa o cliente do valor que ficou para pagar
      if (pedido.dataVencimento && pedido.statusPagamento !== StatusPagamento.PAGO) {
        const { titulo, mensagem } = montarAvisoCobranca('COMPRA_A_PRAZO', {
          numeroPedido: pedido.numero,
          valor: Number(pedido.totalFinal),
          vencimento: new Date(pedido.dataVencimento),
        });
        await tx.notificacaoCliente.create({
          data: {
            clienteId: pedido.clienteId,
            pedidoId: id,
            tipo: 'COMPRA_A_PRAZO',
            titulo,
            mensagem,
            status: 'PENDENTE',
          },
        });
      }

      return pedidoAtualizado;
    });

    const etiqueta = await this.prisma.etiqueta.findUnique({ where: { pedidoId: id } });
    return { pedido: pedidoAprovado, etiqueta };
  }

  async marcarEntregue(
    id: string,
    usuarioId: string,
    papel?: PapelUsuario,
    dto: MarcarEntregueDto = {},
  ) {
    const pedido = await this.findOne(id, usuarioId, papel);
    if (!this.statusPodeEntregar.includes(pedido.status)) {
      throw new BadRequestException('Pedido não pode ser marcado como entregue neste status');
    }
    if (pedido.aguardandoAlteracao) {
      throw new BadRequestException(
        'Há uma solicitação de alteração pendente. Aprove ou negue antes de continuar.',
      );
    }
    const fotoEntrega = dto.fotoEntrega?.trim() ?? '';
    if (!fotoEntrega) {
      throw new BadRequestException('A foto da entrega é obrigatória');
    }
    if (!fotoEntrega.startsWith('data:image/')) {
      throw new BadRequestException('A foto da entrega é inválida');
    }
    if (fotoEntrega.length > 5_500_000) {
      throw new BadRequestException('A foto é muito grande. Tire outra mais simples.');
    }

    const fotoUrl = await this.storage.salvarDataUrl(fotoEntrega);

    await this.prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: {
          status: StatusPedido.ENTREGUE,
          entregueEm: new Date(),
          recebidoPor: dto.recebidoPor?.trim() || null,
          observacaoEntrega: dto.observacaoEntrega?.trim() || null,
          fotoEntrega: fotoUrl,
        },
      });
      await tx.comprovanteEntrega.upsert({
        where: { pedidoId: id },
        create: {
          pedidoId: id,
          motoristaId: pedido.entregadorId ?? usuarioId,
          fotoUrl,
          nomeRecebedor: dto.recebidoPor?.trim() || 'Não informado',
          observacao: dto.observacaoEntrega?.trim() || null,
        },
        update: {
          fotoUrl,
          nomeRecebedor: dto.recebidoPor?.trim() || 'Não informado',
          observacao: dto.observacaoEntrega?.trim() || null,
          dataHora: new Date(),
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'STATUS_ENTREGUE',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: {
            recebidoPor: dto.recebidoPor || null,
            temFoto: !!fotoUrl,
          },
        },
      });
      await registrarHistoricoStatus(tx, id, StatusPedido.ENTREGUE);
    });
    return this.findOne(id, usuarioId, papel);
  }

  async rejeitar(id: string, usuarioId: string, dto: RejeitarPedidoDto) {
    const pedido = await this.findOne(id);
    if (pedido.status !== StatusPedido.AGUARDANDO_APROVACAO) {
      throw new BadRequestException('Só é possível rejeitar pedido aguardando aprovação');
    }
    const motivo = dto.motivo.trim();
    await this.prisma.$transaction([
      this.prisma.pedido.update({
        where: { id },
        data: {
          status: StatusPedido.REJEITADO,
          observacoes: pedido.observacoes
            ? `${pedido.observacoes}\nRejeitado: ${motivo}`
            : `Rejeitado: ${motivo}`,
        },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'REJEITAR_PEDIDO',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: { motivo },
        },
      }),
    ]);
    await registrarHistoricoStatus(this.prisma, id, StatusPedido.REJEITADO);
    return this.findOne(id);
  }

  async atualizarItensAntesAprovacao(
    id: string,
    itens: { produtoId: string; quantidade: number; valorUnitario: number }[],
    usuarioId: string,
  ) {
    const pedido = await this.findOne(id);
    if (pedido.status !== StatusPedido.AGUARDANDO_APROVACAO) {
      throw new BadRequestException('Itens só podem ser ajustados antes da aprovação');
    }
    return this.atualizar(id, { itens }, usuarioId, PapelUsuario.ADMINISTRADOR);
  }

  async atribuir(id: string, dto: AtribuirPedidoDto, usuarioId: string) {
    const pedido = await this.findOne(id);
    if (pedido.status === StatusPedido.AGUARDANDO_APROVACAO) {
      throw new BadRequestException('Atribuição só é permitida a partir de Aprovado');
    }
    if (pedido.status === StatusPedido.CANCELADO || pedido.status === StatusPedido.REJEITADO) {
      throw new BadRequestException('Não é possível atribuir neste status');
    }
    if (!dto.vendedorId && !dto.entregadorId) {
      throw new BadRequestException('Informe vendedorId ou entregadorId');
    }

    if (dto.entregadorId) {
      const entregador = await this.prisma.usuario.findUnique({ where: { id: dto.entregadorId } });
      // Supervisor também faz entregas
      const entrega =
        entregador?.papel === PapelUsuario.MOTORISTA ||
        entregador?.papel === PapelUsuario.SUPERVISOR;
      if (!entregador || !entrega || !entregador.ativo) {
        throw new BadRequestException('Entregador precisa ser um motorista ou supervisor ativo');
      }
    }
    if (dto.vendedorId) {
      const vendedor = await this.prisma.usuario.findUnique({ where: { id: dto.vendedorId } });
      const vende =
        vendedor?.papel === PapelUsuario.VENDEDOR || vendedor?.papel === PapelUsuario.SUPERVISOR;
      if (!vendedor || !vende || !vendedor.ativo) {
        throw new BadRequestException('Vendedor inválido ou inativo');
      }
    }

    await this.prisma.$transaction([
      this.prisma.pedido.update({
        where: { id },
        data: {
          ...(dto.vendedorId ? { vendedorId: dto.vendedorId } : {}),
          ...(dto.entregadorId ? { entregadorId: dto.entregadorId } : {}),
        },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'ATRIBUIR_PEDIDO',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: { vendedorId: dto.vendedorId ?? null, entregadorId: dto.entregadorId ?? null },
        },
      }),
    ]);
    return this.findOne(id);
  }

  async atualizarStatus(id: string, novoStatus: StatusPedido, usuarioId: string) {
    const pedidoAtual = await this.findOne(id);
    if (pedidoAtual.aguardandoAlteracao) {
      throw new BadRequestException(
        'Há uma solicitação de alteração pendente. Aprove ou negue antes de continuar.',
      );
    }
    // Cancelar pedido que já baixou estoque (e ainda não foi entregue) devolve as caixas ao lote de origem
    const devolverEstoque =
      novoStatus === StatusPedido.CANCELADO && this.statusPodeEntregar.includes(pedidoAtual.status);

    const pedidoAtualizado = await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.update({ where: { id }, data: { status: novoStatus } });
      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: `STATUS_${novoStatus}`,
          entidade: 'Pedido',
          entidadeId: id,
        },
      });
      await tx.historicoStatusPedido.create({ data: { pedidoId: id, status: novoStatus } });

      if (devolverEstoque) {
        for (const item of pedidoAtual.itens) {
          await this.devolverItemEmTx(tx, {
            pedidoId: id,
            produtoId: item.produtoId,
            loteId: item.loteId,
            quantidade: Number(item.quantidade),
            origem: `Cancelamento pedido ${pedidoAtual.numero}`,
            usuarioId,
          });
        }
      }

      return pedido;
    });

    // Saiu para entrega pelo painel: avisa o cliente (portal + push)
    if (novoStatus === StatusPedido.EM_ENTREGA && pedidoAtual.status !== StatusPedido.EM_ENTREGA) {
      void this.notificacoes.pedidoACaminho(id);
    }
    return pedidoAtualizado;
  }

  // Regra 6 do escopo: cancelamento não apaga o pedido, só muda o status
  cancelar(id: string, usuarioId: string) {
    return this.atualizarStatus(id, StatusPedido.CANCELADO, usuarioId);
  }

  // Exclusão definitiva: só pedido CANCELADO (o estoque já voltou ao lote no cancelamento).
  async excluir(id: string, usuarioId: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: { select: { razaoSocialOuNome: true } },
        _count: { select: { pagamentos: true } },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.status !== StatusPedido.CANCELADO) {
      throw new BadRequestException('Só é possível excluir pedidos cancelados.');
    }
    if (pedido._count.pagamentos > 0) {
      throw new BadRequestException(
        'Este pedido tem pagamentos registrados. Remova os pagamentos antes de excluir.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Histórico de estoque fica (saída + devolução), só perde o vínculo com o pedido
      await tx.movimentacaoEstoque.updateMany({
        where: { pedidoId: id },
        data: { pedidoId: null },
      });
      await tx.notificacaoCliente.deleteMany({ where: { pedidoId: id } });
      await tx.solicitacaoAlteracaoPedido.deleteMany({ where: { pedidoId: id } });
      await tx.etiqueta.deleteMany({ where: { pedidoId: id } });
      await tx.comprovanteEntrega.deleteMany({ where: { pedidoId: id } });
      // Itens, itens por lote, pagamentos e histórico de status saem em cascata
      await tx.pedido.delete({ where: { id } });
      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'EXCLUIR_PEDIDO',
          entidade: 'Pedido',
          entidadeId: id,
          detalhes: {
            numero: pedido.numero,
            cliente: pedido.cliente?.razaoSocialOuNome ?? null,
            totalFinal: Number(pedido.totalFinal),
          },
        },
      });
    });

    return { ok: true };
  }

  async solicitarAlteracao(
    pedidoId: string,
    dto: CriarSolicitacaoAlteracaoDto,
    usuarioId: string,
    papel?: PapelUsuario,
  ) {
    const pedido = await this.findOne(pedidoId, usuarioId, papel);

    if (!this.statusPodeSolicitar.includes(pedido.status)) {
      throw new BadRequestException(
        'Não é possível solicitar alteração depois que o pedido saiu para entrega',
      );
    }

    const pendente = await this.prisma.solicitacaoAlteracaoPedido.findFirst({
      where: { pedidoId, status: StatusSolicitacaoAlteracao.PENDENTE },
    });
    if (pendente) {
      throw new BadRequestException('Já existe uma solicitação pendente para este pedido');
    }

    if (dto.itens.length === 0) {
      throw new BadRequestException('Informe os produtos da alteração');
    }

    // Cada linha do pedido é produto + lote; sem lote informado, vale quando o produto tem uma linha só
    const snapshot = dto.itens.map((item) => {
      const candidatos = pedido.itens.filter(
        (i) => i.produtoId === item.produtoId && (!item.loteId || i.loteId === item.loteId),
      );
      if (candidatos.length === 0)
        throw new BadRequestException('Só é possível alterar produtos já presentes no pedido');
      if (candidatos.length > 1)
        throw new BadRequestException('Informe o lote do produto que será alterado');
      const atual = candidatos[0];
      return {
        produtoId: item.produtoId,
        loteId: atual.loteId,
        loteNumero: atual.lote?.numero ?? null,
        loteData: atual.lote?.dataEntrada ?? null,
        nome: atual.produto.nome,
        quantidadeOriginal: Math.round(Number(atual.quantidade)),
        quantidadeSolicitada: Math.round(Number(item.quantidade)),
        valorUnitario: Number(atual.valorUnitario),
      };
    });

    if (snapshot.every((i) => i.quantidadeOriginal === i.quantidadeSolicitada)) {
      throw new BadRequestException('A quantidade solicitada é igual à atual');
    }
    if (snapshot.some((i) => i.quantidadeSolicitada < 1)) {
      throw new BadRequestException('A quantidade deve ser maior que zero');
    }

    const extras: { produtoId: string; quantidade: number; loteId: string | null }[] = [];
    for (const item of snapshot) {
      const extra = item.quantidadeSolicitada - item.quantidadeOriginal;
      if (extra > 0)
        extras.push({ produtoId: item.produtoId, quantidade: extra, loteId: item.loteId });
    }
    if (extras.length > 0) await this.validarEstoque(extras);

    const criada = await this.prisma.solicitacaoAlteracaoPedido.create({
      data: {
        pedidoId,
        solicitanteId: usuarioId,
        itens: snapshot as unknown as Prisma.InputJsonValue,
        observacao: dto.observacao,
      },
      include: this.includeSolicitacao(),
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao: 'SOLICITAR_ALTERACAO_PEDIDO',
        entidade: 'Pedido',
        entidadeId: pedidoId,
        detalhes: { solicitacaoId: criada.id, itens: snapshot },
      },
    });

    return this.formatarSolicitacao(criada);
  }

  async listarSolicitacoes(
    filtros: { status?: StatusSolicitacaoAlteracao } = {},
    usuarioId?: string,
    papel?: PapelUsuario,
  ) {
    const where: Prisma.SolicitacaoAlteracaoPedidoWhereInput = {};
    if (filtros.status) where.status = filtros.status;
    if (papel === PapelUsuario.VENDEDOR) where.solicitanteId = usuarioId;

    const lista = await this.prisma.solicitacaoAlteracaoPedido.findMany({
      where,
      include: this.includeSolicitacao(),
      orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }],
    });
    return lista.map((s) => this.formatarSolicitacao(s));
  }

  async listarSolicitacoesDoPedido(pedidoId: string, usuarioId?: string, papel?: PapelUsuario) {
    await this.findOne(pedidoId, usuarioId, papel);
    const lista = await this.prisma.solicitacaoAlteracaoPedido.findMany({
      where: { pedidoId },
      include: this.includeSolicitacao(),
      orderBy: { criadoEm: 'desc' },
    });
    return lista.map((s) => this.formatarSolicitacao(s));
  }

  async aprovarSolicitacao(id: string, usuarioId: string) {
    const solicitacao = await this.prisma.solicitacaoAlteracaoPedido.findUnique({
      where: { id },
      include: this.includeSolicitacao(),
    });
    if (!solicitacao) throw new NotFoundException('Solicitação não encontrada');
    if (solicitacao.status !== StatusSolicitacaoAlteracao.PENDENTE) {
      throw new BadRequestException('Esta solicitação já foi respondida');
    }

    const itens = (solicitacao.itens as any[]).map((i) => ({
      produtoId: i.produtoId,
      loteId: (i.loteId as string | null | undefined) ?? null,
      quantidade: Number(i.quantidadeSolicitada),
    }));

    const pedido = await this.aplicarItensAposAprovacao(solicitacao.pedidoId, itens, usuarioId);
    let etiquetaId = pedido.etiqueta?.id ?? null;
    if (!etiquetaId) {
      const gerada = await this.etiquetasService.garantirParaPedido(solicitacao.pedidoId);
      etiquetaId = gerada.id;
    }
    const totalNovo = pedido.itens.reduce((acc, i) => acc + Math.round(Number(i.quantidade)), 0);
    const jaImpressas =
      solicitacao.pedido.caixasEtiquetadas > 0
        ? solicitacao.pedido.caixasEtiquetadas
        : (solicitacao.itens as any[]).reduce((acc, i) => acc + Number(i.quantidadeOriginal), 0);

    const etiquetasExtras =
      totalNovo > jaImpressas ? { de: jaImpressas + 1, ate: totalNovo } : null;

    const [atualizada] = await this.prisma.$transaction([
      this.prisma.solicitacaoAlteracaoPedido.update({
        where: { id },
        data: {
          status: StatusSolicitacaoAlteracao.APROVADA,
          respondidoPorId: usuarioId,
          respondidoEm: new Date(),
        },
        include: this.includeSolicitacao(),
      }),
      this.prisma.pedido.update({
        where: { id: solicitacao.pedidoId },
        data: { caixasEtiquetadas: totalNovo },
      }),
      this.prisma.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'APROVAR_ALTERACAO_PEDIDO',
          entidade: 'Pedido',
          entidadeId: solicitacao.pedidoId,
          detalhes: { solicitacaoId: id, etiquetasExtras },
        },
      }),
    ]);

    return {
      solicitacao: this.formatarSolicitacao(atualizada),
      etiquetasExtras,
      etiquetaId,
    };
  }

  async negarSolicitacao(id: string, usuarioId: string, resposta?: string) {
    const solicitacao = await this.prisma.solicitacaoAlteracaoPedido.findUnique({ where: { id } });
    if (!solicitacao) throw new NotFoundException('Solicitação não encontrada');
    if (solicitacao.status !== StatusSolicitacaoAlteracao.PENDENTE) {
      throw new BadRequestException('Esta solicitação já foi respondida');
    }

    const atualizada = await this.prisma.solicitacaoAlteracaoPedido.update({
      where: { id },
      data: {
        status: StatusSolicitacaoAlteracao.NEGADA,
        resposta: resposta?.trim() || null,
        respondidoPorId: usuarioId,
        respondidoEm: new Date(),
      },
      include: this.includeSolicitacao(),
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao: 'NEGAR_ALTERACAO_PEDIDO',
        entidade: 'Pedido',
        entidadeId: solicitacao.pedidoId,
        detalhes: { solicitacaoId: id, resposta },
      },
    });

    return this.formatarSolicitacao(atualizada);
  }

  private includeSolicitacao() {
    return {
      pedido: {
        include: {
          cliente: { select: { id: true, razaoSocialOuNome: true } },
          vendedor: { select: { id: true, nome: true } },
          etiqueta: { select: { id: true } },
        },
      },
      solicitante: { select: { id: true, nome: true } },
      respondidoPor: { select: { id: true, nome: true } },
    };
  }

  private formatarSolicitacao(s: any) {
    const itens = (s.itens ?? []) as {
      produtoId: string;
      nome: string;
      quantidadeOriginal: number;
      quantidadeSolicitada: number;
    }[];
    const original = itens.reduce((acc, i) => acc + Number(i.quantidadeOriginal || 0), 0);
    const solicitada = itens.reduce((acc, i) => acc + Number(i.quantidadeSolicitada || 0), 0);
    return {
      ...s,
      quantidadeOriginal: original,
      quantidadeSolicitada: solicitada,
      delta: solicitada - original,
    };
  }

  // Aplica a alteração aprovada linha a linha (produto + lote): aumento baixa do mesmo lote,
  // redução devolve ao lote. Linhas que não estão na solicitação ficam como estão.
  private async aplicarItensAposAprovacao(
    pedidoId: string,
    alteracoes: { produtoId: string; loteId: string | null; quantidade: number }[],
    usuarioId: string,
  ) {
    const pedido = await this.findOne(pedidoId);
    const porChave = new Map(alteracoes.map((a) => [this.chaveItem(a), a.quantidade]));

    // Pedidos antigos: a linha não tinha lote e a solicitação não informa; casa pelo produto
    const linha = (item: { produtoId: string; loteId: string | null }) =>
      porChave.get(this.chaveItem(item)) ??
      (item.loteId
        ? porChave.get(this.chaveItem({ produtoId: item.produtoId, loteId: null }))
        : undefined);

    const extras = pedido.itens
      .map((item) => ({
        produtoId: item.produtoId,
        loteId: item.loteId,
        quantidade: (linha(item) ?? Number(item.quantidade)) - Number(item.quantidade),
      }))
      .filter((e) => e.quantidade > 0);
    if (extras.length > 0) await this.validarEstoque(extras);

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      for (const item of pedido.itens) {
        const atual = Number(item.quantidade);
        const nova = linha(item) ?? atual;
        const valorUnitario = Number(item.valorUnitario);
        subtotal += nova * valorUnitario;
        const delta = nova - atual;
        if (delta === 0) continue;

        await tx.itemPedido.update({
          where: { id: item.id },
          data: { quantidade: nova, valorTotal: nova * valorUnitario },
        });

        const origem = `Ajuste pedido ${pedido.numero}`;
        if (delta > 0) {
          await this.baixarItemEmTx(tx, {
            pedidoId,
            produtoId: item.produtoId,
            produtoNome: item.produto.nome,
            loteId: item.loteId,
            quantidade: delta,
            valorUnitario,
            origem,
            usuarioId,
          });
        } else {
          await this.devolverItemEmTx(tx, {
            pedidoId,
            produtoId: item.produtoId,
            loteId: item.loteId,
            quantidade: Math.abs(delta),
            origem,
            usuarioId,
          });
        }
      }

      const totalFinal = subtotal + Number(pedido.valorFrete) - Number(pedido.descontoValor);
      return tx.pedido.update({
        where: { id: pedidoId },
        data: { subtotal, totalFinal },
        include: { itens: true, etiqueta: true },
      });
    });
  }
}
