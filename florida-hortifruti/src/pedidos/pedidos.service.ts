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
  StatusPedido,
  StatusSolicitacaoAlteracao,
  TipoMovimentacao,
} from '@prisma/client';
import { StorageService } from '../common/storage.service';

@Injectable()
export class PedidosService {
  constructor(
    private prisma: PrismaService,
    private estoqueService: EstoqueService,
    private etiquetasService: EtiquetasService,
    private storage: StorageService,
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
  async create(
    dto: CreatePedidoDto,
    vendedorId: string | null,
    opts: { origem?: OrigemPedido; clienteId?: string } = {},
  ) {
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

    return this.prisma.pedido.create({
      data: {
        clienteId,
        vendedorId: origem === OrigemPedido.VENDEDOR ? vendedorId : vendedorId,
        origem,
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

    return this.prisma.pedido
      .findMany({
        where,
        include: {
          cliente: true,
          vendedor: true,
          entregador: { select: { id: true, nome: true } },
          itens: { include: { produto: true } },
          etiqueta: true,
          comprovanteEntrega: true,
          solicitacoesAlteracao: {
            where: { status: StatusSolicitacaoAlteracao.PENDENTE },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { criadoEm: 'desc' },
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
        itens: { include: { produto: { include: { categoria: true } } } },
        etiqueta: true,
        comprovanteEntrega: true,
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
    const itens =
      dto.itens ??
      pedido.itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: Number(i.quantidade),
        valorUnitario: Number(i.valorUnitario),
      }));

    if (itens.length === 0) {
      throw new BadRequestException('O pedido precisa ter pelo menos um produto');
    }
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

    const totalCaixas = pedido.itens.reduce(
      (acc, item) => acc + Math.round(Number(item.quantidade)),
      0,
    );

    const [pedidoAprovado] = await this.prisma.$transaction([
      this.prisma.pedido.update({
        where: { id },
        data: { status: StatusPedido.APROVADO, caixasEtiquetadas: Math.max(1, totalCaixas) },
      }),
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
    if (dto.fotoEntrega && !dto.fotoEntrega.startsWith('data:image/')) {
      throw new BadRequestException('A foto da entrega é inválida');
    }
    if (dto.fotoEntrega && dto.fotoEntrega.length > 5_500_000) {
      throw new BadRequestException('A foto é muito grande. Tire outra mais simples.');
    }

    let fotoUrl: string | null = null;
    if (dto.fotoEntrega) {
      fotoUrl = await this.storage.salvarDataUrl(dto.fotoEntrega);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: {
          status: StatusPedido.ENTREGUE,
          entregueEm: new Date(),
          recebidoPor: dto.recebidoPor?.trim() || null,
          observacaoEntrega: dto.observacaoEntrega?.trim() || null,
          fotoEntrega: fotoUrl ?? dto.fotoEntrega ?? null,
        },
      });
      if (dto.recebidoPor?.trim() || fotoUrl) {
        await tx.comprovanteEntrega.upsert({
          where: { pedidoId: id },
          create: {
            pedidoId: id,
            motoristaId: pedido.entregadorId ?? usuarioId,
            fotoUrl: fotoUrl ?? dto.fotoEntrega ?? '',
            nomeRecebedor: dto.recebidoPor?.trim() || 'Não informado',
            observacao: dto.observacaoEntrega?.trim() || null,
          },
          update: {
            fotoUrl: fotoUrl ?? dto.fotoEntrega ?? '',
            nomeRecebedor: dto.recebidoPor?.trim() || 'Não informado',
            observacao: dto.observacaoEntrega?.trim() || null,
            dataHora: new Date(),
          },
        });
      }
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
      const motorista = await this.prisma.usuario.findUnique({ where: { id: dto.entregadorId } });
      if (!motorista || motorista.papel !== PapelUsuario.MOTORISTA || !motorista.ativo) {
        throw new BadRequestException('Entregador precisa ser um motorista ativo');
      }
    }
    if (dto.vendedorId) {
      const vendedor = await this.prisma.usuario.findUnique({ where: { id: dto.vendedorId } });
      if (!vendedor || vendedor.papel !== PapelUsuario.VENDEDOR || !vendedor.ativo) {
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

    const atuais = new Map(pedido.itens.map((i) => [i.produtoId, i]));
    if (dto.itens.length === 0) {
      throw new BadRequestException('Informe os produtos da alteração');
    }

    const snapshot = dto.itens.map((item) => {
      const atual = atuais.get(item.produtoId);
      if (!atual)
        throw new BadRequestException('Só é possível alterar produtos já presentes no pedido');
      return {
        produtoId: item.produtoId,
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

    const extras: { produtoId: string; quantidade: number }[] = [];
    for (const item of snapshot) {
      const extra = item.quantidadeSolicitada - item.quantidadeOriginal;
      if (extra > 0) extras.push({ produtoId: item.produtoId, quantidade: extra });
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
      quantidade: Number(i.quantidadeSolicitada),
      valorUnitario: Number(i.valorUnitario),
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

  private async aplicarItensAposAprovacao(
    pedidoId: string,
    itens: { produtoId: string; quantidade: number; valorUnitario: number }[],
    usuarioId: string,
  ) {
    const pedido = await this.findOne(pedidoId);
    const itensAntigos = pedido.itens.map((i) => ({
      produtoId: i.produtoId,
      quantidade: Number(i.quantidade),
    }));

    const antigo = this.somarPorProduto(itensAntigos);
    const novo = this.somarPorProduto(itens);
    const extras: { produtoId: string; quantidade: number }[] = [];
    for (const [produtoId, quantidade] of novo) {
      const extra = quantidade - (antigo.get(produtoId) ?? 0);
      if (extra > 0) extras.push({ produtoId, quantidade: extra });
    }
    if (extras.length > 0) await this.validarEstoque(extras);

    const itensCalculados = itens.map((i) => ({
      ...i,
      valorTotal: i.quantidade * i.valorUnitario,
    }));
    const subtotal = itensCalculados.reduce((acc, i) => acc + i.valorTotal, 0);
    const frete = Number(pedido.valorFrete);
    const desconto = Number(pedido.descontoValor);
    const totalFinal = subtotal + frete - desconto;

    return this.prisma.$transaction(async (tx) => {
      await tx.itemPedido.deleteMany({ where: { pedidoId } });
      await tx.itemPedido.createMany({
        data: itensCalculados.map((i) => ({ pedidoId, ...i })),
      });

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
            pedidoId,
            usuarioId,
          },
        });
      }

      return tx.pedido.update({
        where: { id: pedidoId },
        data: { subtotal, totalFinal },
        include: { itens: true, etiqueta: true },
      });
    });
  }
}
