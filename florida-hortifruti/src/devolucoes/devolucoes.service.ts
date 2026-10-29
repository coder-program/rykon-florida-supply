import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PapelUsuario, Prisma, StatusPedido, TipoMovimentacao } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../common/storage.service';
import { EstoqueService } from '../estoque/estoque.service';
import {
  AtualizarStatusDevolucaoDto,
  CriarDevolucaoDto,
  CriarDevolucaoItemDto,
  MotivoDevolucao,
  StatusDevolucao,
} from './dto/devolucao.dto';

const ACAO_DEVOLUCAO = 'REGISTRAR_DEVOLUCAO';

const PAPEIS_REGISTRAM = new Set<PapelUsuario>([
  PapelUsuario.VENDEDOR,
  PapelUsuario.SUPERVISOR,
  PapelUsuario.MOTORISTA,
  PapelUsuario.REVENDEDOR,
]);

const MOTIVO_LABEL: Record<MotivoDevolucao, string> = {
  [MotivoDevolucao.ESTRAGADO]: 'Estragado',
  [MotivoDevolucao.REFUGO]: 'Refugo',
  [MotivoDevolucao.MELADO]: 'Melado',
  [MotivoDevolucao.MUITO_MADURO]: 'Muito maduro',
  [MotivoDevolucao.MUITO_VERDE]: 'Muito verde',
  [MotivoDevolucao.OUTROS]: 'Outros',
};

type ItemDevolvido = {
  produtoId: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  motivos: MotivoDevolucao[];
  motivoOutro?: string;
};

function textoMotivos(item: Pick<ItemDevolvido, 'motivos' | 'motivoOutro'>) {
  return item.motivos
    .map((m) =>
      m === MotivoDevolucao.OUTROS && item.motivoOutro ? item.motivoOutro : MOTIVO_LABEL[m],
    )
    .join(', ');
}

const INCLUDE_PEDIDO_DEVOLUCAO = {
  cliente: true,
  etiqueta: { select: { id: true, tokenPublico: true } },
  itens: { include: { produto: true } },
} satisfies Prisma.PedidoInclude;

type PedidoDevolucao = Prisma.PedidoGetPayload<{ include: typeof INCLUDE_PEDIDO_DEVOLUCAO }>;

type DevolucaoDetalhes = {
  pedidoId?: string;
  pedidoNumero?: number;
  etiquetaId?: string;
  etiquetaToken: string;
  fotos: string[];
  itens: ItemDevolvido[];
  observacao?: string;
  itensDevolvidos?: string;
  quantidadeCaixas?: number;
  valorDevolucao?: number;
  status: StatusDevolucao;
  resposta?: string;
  criadoEm: string;
};

@Injectable()
export class DevolucoesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private estoque: EstoqueService,
  ) {}

  private extrairToken(raw: string) {
    const valor = String(raw ?? '').trim();
    if (!valor) return '';

    const match = valor.match(/(?:\/abrir-pedido\/|\/p\/)?([0-9a-fA-F-]{36})$/);
    return match?.[1] ?? valor;
  }

  private toDetalhes(raw: Prisma.JsonValue | null): DevolucaoDetalhes {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
    const status =
      obj.status === StatusDevolucao.CONCLUIDA || obj.status === StatusDevolucao.NEGADA
        ? obj.status
        : StatusDevolucao.PENDENTE;

    return {
      pedidoId: obj.pedidoId ? String(obj.pedidoId) : undefined,
      pedidoNumero:
        typeof obj.pedidoNumero === 'number' && Number.isFinite(obj.pedidoNumero)
          ? Number(obj.pedidoNumero)
          : undefined,
      etiquetaId: obj.etiquetaId ? String(obj.etiquetaId) : undefined,
      etiquetaToken: String(obj.etiquetaToken ?? ''),
      fotos: Array.isArray(obj.fotos) ? obj.fotos.map(String) : [],
      itens: Array.isArray(obj.itens)
        ? obj.itens
            .map((item: any) => ({
              produtoId: String(item?.produtoId ?? ''),
              nome: String(item?.nome ?? ''),
              quantidade: Number(item?.quantidade ?? 0),
              valorUnitario: Number(item?.valorUnitario ?? 0),
              valorTotal: Number(item?.valorTotal ?? 0),
              // Devoluções antigas não tinham motivo
              motivos: Array.isArray(item?.motivos)
                ? item.motivos.filter((m: string) => m in MOTIVO_LABEL)
                : [],
              motivoOutro: item?.motivoOutro ? String(item.motivoOutro) : undefined,
            }))
            .filter((item: ItemDevolvido) => item.produtoId && item.quantidade > 0)
        : [],
      observacao: obj.observacao ? String(obj.observacao) : undefined,
      itensDevolvidos: obj.itensDevolvidos ? String(obj.itensDevolvidos) : undefined,
      quantidadeCaixas:
        typeof obj.quantidadeCaixas === 'number' && Number.isFinite(obj.quantidadeCaixas)
          ? Number(obj.quantidadeCaixas)
          : undefined,
      valorDevolucao:
        typeof obj.valorDevolucao === 'number' && Number.isFinite(obj.valorDevolucao)
          ? Number(obj.valorDevolucao)
          : undefined,
      status,
      resposta: obj.resposta ? String(obj.resposta) : undefined,
      criadoEm: obj.criadoEm ? String(obj.criadoEm) : new Date().toISOString(),
    };
  }

  private async enrich(logs: any[]) {
    const pedidoIds = [...new Set(logs.map((l) => l.entidadeId).filter(Boolean))];
    const pedidos = pedidoIds.length
      ? await this.prisma.pedido.findMany({
          where: { id: { in: pedidoIds } },
          include: {
            cliente: true,
            vendedor: { select: { id: true, nome: true } },
            etiqueta: { select: { id: true, tokenPublico: true } },
          },
        })
      : [];

    return logs.map((log) => {
      const detalhes = this.toDetalhes(log.detalhes);
      const pedido = pedidos.find((p) => p.id === log.entidadeId);
      return {
        id: log.id,
        pedidoId: log.entidadeId,
        pedidoNumero: pedido?.numero ?? null,
        cliente: pedido?.cliente?.razaoSocialOuNome ?? null,
        vendedor: pedido?.vendedor?.nome ?? null,
        etiquetaId: detalhes.etiquetaId ?? pedido?.etiqueta?.id ?? null,
        status: detalhes.status,
        etiquetaToken: detalhes.etiquetaToken || pedido?.etiqueta?.tokenPublico || null,
        itens: detalhes.itens.map((item) => ({
          ...item,
          motivosTexto: item.motivos.length ? textoMotivos(item) : null,
        })),
        itensDevolvidos: detalhes.itensDevolvidos ?? null,
        quantidadeCaixas: detalhes.quantidadeCaixas ?? null,
        valorDevolucao: detalhes.valorDevolucao ?? null,
        observacao: detalhes.observacao ?? null,
        resposta: detalhes.resposta ?? null,
        fotos: detalhes.fotos,
        criadoEm: log.data,
        registradoPor: log.usuario?.nome ?? null,
      };
    });
  }

  // Vendedor vê os pedidos que vendeu, motorista os que entregou; supervisor faz os dois papéis
  private filtroDoUsuario(usuarioId: string, papel: PapelUsuario): Prisma.PedidoWhereInput {
    if (papel === PapelUsuario.MOTORISTA) return { entregadorId: usuarioId };
    if (papel === PapelUsuario.VENDEDOR || papel === PapelUsuario.REVENDEDOR)
      return { vendedorId: usuarioId };
    return { OR: [{ vendedorId: usuarioId }, { entregadorId: usuarioId }] };
  }

  private pertenceAoUsuario(
    pedido: { vendedorId: string | null; entregadorId: string | null },
    usuarioId: string,
    papel: PapelUsuario,
  ) {
    if (papel === PapelUsuario.MOTORISTA) return pedido.entregadorId === usuarioId;
    if (papel === PapelUsuario.VENDEDOR || papel === PapelUsuario.REVENDEDOR)
      return pedido.vendedorId === usuarioId;
    return pedido.vendedorId === usuarioId || pedido.entregadorId === usuarioId;
  }

  private garantirPapel(papel: PapelUsuario) {
    if (!PAPEIS_REGISTRAM.has(papel)) {
      throw new ForbiddenException('Você não pode registrar devolução');
    }
  }

  // Busca pelo pedido escolhido na lista ou pelo QR da etiqueta, e confere se o usuário pode usá-lo
  private async carregarPedido(
    ref: { pedidoId?: string; etiquetaToken?: string },
    usuarioId: string,
    papel: PapelUsuario,
  ): Promise<PedidoDevolucao> {
    let pedido: PedidoDevolucao | null = null;
    if (ref.pedidoId?.trim()) {
      pedido = await this.prisma.pedido.findUnique({
        where: { id: ref.pedidoId.trim() },
        include: INCLUDE_PEDIDO_DEVOLUCAO,
      });
      if (!pedido) throw new NotFoundException('Pedido não encontrado');
    } else {
      const token = this.extrairToken(ref.etiquetaToken ?? '');
      if (!token) throw new BadRequestException('Selecione o pedido ou informe a etiqueta');
      const etiqueta = await this.prisma.etiqueta.findUnique({
        where: { tokenPublico: token },
        include: { pedido: { include: INCLUDE_PEDIDO_DEVOLUCAO } },
      });
      if (!etiqueta?.pedido) throw new NotFoundException('Etiqueta não encontrada');
      pedido = etiqueta.pedido;
    }

    if (!this.pertenceAoUsuario(pedido, usuarioId, papel)) {
      throw new ForbiddenException('Você só pode registrar devolução dos seus pedidos');
    }
    if (pedido.status !== StatusPedido.ENTREGUE) {
      throw new BadRequestException('Só é possível registrar devolução de pedido entregue');
    }
    return pedido;
  }

  // Produto dividido entre lotes vira uma linha só para quem registra a devolução
  private resumoPedido(pedido: PedidoDevolucao) {
    const itens = new Map<string, { produtoId: string; nome: string; quantidade: number }>();
    for (const item of pedido.itens) {
      const atual = itens.get(item.produtoId);
      if (atual) atual.quantidade += Number(item.quantidade);
      else
        itens.set(item.produtoId, {
          produtoId: item.produtoId,
          nome: item.produto?.nome ?? item.produtoId,
          quantidade: Number(item.quantidade),
        });
    }
    return {
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero,
      cliente: pedido.cliente?.razaoSocialOuNome ?? null,
      entregueEm: pedido.entregueEm,
      etiquetaId: pedido.etiqueta?.id ?? null,
      etiquetaToken: pedido.etiqueta?.tokenPublico ?? null,
      itens: [...itens.values()].filter((item) => item.quantidade > 0),
    };
  }

  async listarPedidosParaDevolucao(usuarioId: string, papel: PapelUsuario) {
    this.garantirPapel(papel);
    const pedidos = await this.prisma.pedido.findMany({
      where: { ...this.filtroDoUsuario(usuarioId, papel), status: StatusPedido.ENTREGUE },
      include: INCLUDE_PEDIDO_DEVOLUCAO,
      orderBy: [{ entregueEm: 'desc' }, { numero: 'desc' }],
      take: 200,
    });
    return pedidos.map((p) => this.resumoPedido(p));
  }

  async criar(dto: CriarDevolucaoDto, usuarioId: string, papel: PapelUsuario) {
    this.garantirPapel(papel);
    if (!Array.isArray(dto.fotos) || dto.fotos.length !== 3) {
      throw new BadRequestException('Envie exatamente 3 fotos da devolução');
    }

    const pedido = await this.carregarPedido(dto, usuarioId, papel);

    const itensPedido = pedido.itens.map((item) => ({
      produtoId: item.produtoId,
      nome: item.produto?.nome ?? item.produtoId,
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valorUnitario),
    }));

    const itensDevolvidos = this.validarItensDevolvidos(dto.itens, itensPedido);
    const quantidadeCaixas = itensDevolvidos.reduce((acc, item) => acc + item.quantidade, 0);
    const valorDevolucao = itensDevolvidos.reduce((acc, item) => acc + item.valorTotal, 0);

    const fotosUrl: string[] = [];
    for (const foto of dto.fotos) {
      if (!foto?.startsWith('data:image/')) {
        throw new BadRequestException('Uma das fotos é inválida');
      }
      fotosUrl.push(await this.storage.salvarDataUrl(foto));
    }

    const detalhes: DevolucaoDetalhes = {
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero,
      etiquetaId: pedido.etiqueta?.id,
      etiquetaToken: pedido.etiqueta?.tokenPublico ?? '',
      fotos: fotosUrl,
      itens: itensDevolvidos,
      observacao: dto.observacao?.trim() || undefined,
      itensDevolvidos: itensDevolvidos
        .map((item) => `${item.quantidade}x ${item.nome} (${textoMotivos(item)})`)
        .join(', '),
      quantidadeCaixas: dto.quantidadeCaixas ?? quantidadeCaixas,
      valorDevolucao,
      status: StatusDevolucao.PENDENTE,
      criadoEm: new Date().toISOString(),
    };

    const log = await this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao: ACAO_DEVOLUCAO,
        entidade: 'DevolucaoPedido',
        entidadeId: pedido.id,
        detalhes: detalhes as unknown as Prisma.InputJsonValue,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });

    const [item] = await this.enrich([log]);
    return item;
  }

  async listarMinhas(usuarioId: string) {
    const logs = await this.prisma.logAuditoria.findMany({
      where: { acao: ACAO_DEVOLUCAO, usuarioId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { data: 'desc' },
    });
    return this.enrich(logs);
  }

  async buscarPedidoPorEtiqueta(tokenRaw: string, usuarioId: string, papel: PapelUsuario) {
    this.garantirPapel(papel);
    const pedido = await this.carregarPedido({ etiquetaToken: tokenRaw }, usuarioId, papel);
    return this.resumoPedido(pedido);
  }

  async listarTodas() {
    const logs = await this.prisma.logAuditoria.findMany({
      where: { acao: ACAO_DEVOLUCAO },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { data: 'desc' },
    });
    return this.enrich(logs);
  }

  async atualizarStatus(id: string, dto: AtualizarStatusDevolucaoDto, usuarioId: string) {
    const log = await this.prisma.logAuditoria.findUnique({ where: { id } });
    if (!log || log.acao !== ACAO_DEVOLUCAO) {
      throw new NotFoundException('Devolução não encontrada');
    }

    const base = this.toDetalhes(log.detalhes);
    if (base.status === StatusDevolucao.CONCLUIDA) {
      throw new BadRequestException('Devolução já concluída. Não é possível alterar novamente.');
    }

    if (dto.status === StatusDevolucao.CONCLUIDA) {
      await this.aplicarDevolucaoNoPedido(log.entidadeId, base, usuarioId);
    }

    const atualizados: DevolucaoDetalhes = {
      ...base,
      status: dto.status,
      resposta: dto.resposta?.trim() || undefined,
    };

    const salvo = await this.prisma.logAuditoria.update({
      where: { id },
      data: {
        detalhes: atualizados as unknown as Prisma.InputJsonValue,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    });

    await this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao: 'ATUALIZAR_STATUS_DEVOLUCAO',
        entidade: 'DevolucaoPedido',
        entidadeId: log.entidadeId,
        detalhes: {
          devolucaoId: id,
          status: dto.status,
          resposta: dto.resposta?.trim() || null,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const [item] = await this.enrich([salvo]);
    return item;
  }

  async resumo(query: { dataInicio?: string; dataFim?: string } = {}) {
    const where: Prisma.LogAuditoriaWhereInput = { acao: ACAO_DEVOLUCAO };

    if (query.dataInicio || query.dataFim) {
      where.data = {};
      if (query.dataInicio) {
        const [y, m, d] = query.dataInicio.split('-').map(Number);
        where.data.gte = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
      }
      if (query.dataFim) {
        const [y, m, d] = query.dataFim.split('-').map(Number);
        where.data.lte = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
      }
    }

    const logs = await this.prisma.logAuditoria.findMany({ where, select: { detalhes: true } });

    const resumo = {
      total: logs.length,
      pendentes: 0,
      concluidas: 0,
      negadas: 0,
      totalCaixas: 0,
      valorTotal: 0,
    };

    for (const log of logs) {
      const detalhes = this.toDetalhes(log.detalhes);
      const status = detalhes.status;
      if (status === StatusDevolucao.CONCLUIDA) resumo.concluidas += 1;
      else if (status === StatusDevolucao.NEGADA) resumo.negadas += 1;
      else resumo.pendentes += 1;

      if (detalhes.quantidadeCaixas && detalhes.quantidadeCaixas > 0) {
        resumo.totalCaixas += detalhes.quantidadeCaixas;
      }

      if (detalhes.valorDevolucao && detalhes.valorDevolucao > 0) {
        resumo.valorTotal += detalhes.valorDevolucao;
      }
    }

    return resumo;
  }

  private validarItensDevolvidos(
    itensDto: CriarDevolucaoItemDto[],
    itensPedido: { produtoId: string; nome: string; quantidade: number; valorUnitario: number }[],
  ): ItemDevolvido[] {
    if (!Array.isArray(itensDto) || itensDto.length === 0) {
      throw new BadRequestException('Informe ao menos um item devolvido');
    }

    // Produto dividido entre lotes vira uma linha só (soma das quantidades, preço médio)
    const mapaPedido = new Map<string, (typeof itensPedido)[number]>();
    for (const item of itensPedido) {
      const atual = mapaPedido.get(item.produtoId);
      if (!atual) {
        mapaPedido.set(item.produtoId, { ...item });
        continue;
      }
      const quantidade = atual.quantidade + item.quantidade;
      const valor = atual.quantidade * atual.valorUnitario + item.quantidade * item.valorUnitario;
      mapaPedido.set(item.produtoId, {
        ...atual,
        quantidade,
        valorUnitario:
          quantidade > 0 ? Number((valor / quantidade).toFixed(2)) : atual.valorUnitario,
      });
    }

    return itensDto.map((itemDto) => {
      const pedidoItem = mapaPedido.get(itemDto.produtoId);
      if (!pedidoItem) {
        throw new BadRequestException('Item devolvido não pertence ao pedido');
      }
      const qtd = Number(itemDto.quantidade ?? 0);
      if (!Number.isFinite(qtd) || qtd <= 0) {
        throw new BadRequestException('Quantidade devolvida inválida');
      }
      if (qtd > pedidoItem.quantidade) {
        throw new BadRequestException(
          `Quantidade devolvida acima do pedido para ${pedidoItem.nome}`,
        );
      }

      const motivos = [...new Set(itemDto.motivos ?? [])];
      if (motivos.length === 0) {
        throw new BadRequestException(`Informe o motivo da devolução de ${pedidoItem.nome}`);
      }
      const motivoOutro = itemDto.motivoOutro?.trim() || undefined;
      if (motivos.includes(MotivoDevolucao.OUTROS) && !motivoOutro) {
        throw new BadRequestException(`Escreva o motivo "Outros" de ${pedidoItem.nome}`);
      }

      const valorTotal = qtd * pedidoItem.valorUnitario;
      return {
        produtoId: pedidoItem.produtoId,
        nome: pedidoItem.nome,
        quantidade: qtd,
        valorUnitario: pedidoItem.valorUnitario,
        valorTotal,
        motivos,
        motivoOutro: motivos.includes(MotivoDevolucao.OUTROS) ? motivoOutro : undefined,
      };
    });
  }

  private async aplicarDevolucaoNoPedido(
    pedidoId: string,
    devolucao: DevolucaoDetalhes,
    usuarioId: string,
  ) {
    if (!devolucao.itens.length) {
      throw new BadRequestException('Não há itens devolvidos para aplicar no pedido');
    }

    await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { itens: true },
      });
      if (!pedido) throw new NotFoundException('Pedido da devolução não encontrado');

      const mapaDevolucao = new Map(
        devolucao.itens.map((item) => [item.produtoId, Number(item.quantidade)]),
      );

      // Produto dividido entre lotes: a devolução é distribuída pelas linhas do produto,
      // e cada parte volta para o lote de onde saiu
      for (const [produtoId, qtdTotal] of mapaDevolucao) {
        const linhas = pedido.itens.filter((item) => item.produtoId === produtoId);
        const totalPedido = linhas.reduce((acc, item) => acc + Number(item.quantidade), 0);
        if (qtdTotal <= 0) continue;
        if (qtdTotal > totalPedido) {
          throw new BadRequestException('Quantidade devolvida excede o saldo atual do pedido');
        }

        let restante = qtdTotal;
        for (const item of [...linhas].reverse()) {
          if (restante <= 0) break;
          const atual = Number(item.quantidade);
          const qtdDevolvida = Math.min(restante, atual);
          if (qtdDevolvida <= 0) continue;
          restante -= qtdDevolvida;

          const novaQtd = atual - qtdDevolvida;
          const valorUnitario = Number(item.valorUnitario);
          await tx.itemPedido.update({
            where: { id: item.id },
            data: {
              quantidade: novaQtd,
              valorTotal: novaQtd * valorUnitario,
            },
          });

          const origem = `Devolução do pedido ${pedido.numero}`;
          const movimentacao = await tx.movimentacaoEstoque.create({
            data: {
              produtoId,
              tipo: TipoMovimentacao.ENTRADA,
              quantidade: qtdDevolvida,
              origem,
              pedidoId,
              usuarioId,
            },
          });
          await this.estoque.devolverDoPedidoEmTx(tx, {
            pedidoId,
            produtoId,
            quantidade: qtdDevolvida,
            movimentacaoId: movimentacao.id,
            origem,
            loteIdPreferido: item.loteId,
          });
        }
      }

      const itensAtualizados = await tx.itemPedido.findMany({ where: { pedidoId } });
      const novoSubtotal = itensAtualizados.reduce((acc, item) => acc + Number(item.valorTotal), 0);
      const frete = Number(pedido.valorFrete ?? 0);
      const desconto = Number(pedido.descontoValor ?? 0);
      const totalFinal = Math.max(0, novoSubtotal + frete - desconto);

      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          subtotal: novoSubtotal,
          totalFinal,
        },
      });
    });
  }
}
