import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PapelUsuario, Prisma, StatusPedido, TipoMovimentacao } from '@prisma/client';
import { dataEfetiva, hojeEmBrasilia } from '../common/data-efetiva';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../common/storage.service';
import { EstoqueService } from '../estoque/estoque.service';
import {
  AtualizarStatusDevolucaoDto,
  CriarDevolucaoDto,
  CriarDevolucaoItemDto,
  MotivoDevolucao,
  RegistrarReembolsoDto,
  StatusDevolucao,
  TipoReembolso,
} from './dto/devolucao.dto';

const ACAO_DEVOLUCAO = 'REGISTRAR_DEVOLUCAO';

const PAPEIS_REGISTRAM = new Set<PapelUsuario>([
  PapelUsuario.VENDEDOR,
  PapelUsuario.SUPERVISOR,
  PapelUsuario.MOTORISTA,
  PapelUsuario.REVENDEDOR,
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.ADMINISTRATIVO,
]);

// Registram sem foto
const PAPEIS_ESCRITORIO = new Set<PapelUsuario>([
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.ADMINISTRATIVO,
]);

// Registram direto, sem passar pela aprovação; também veem o histórico de todos os pedidos
const PAPEIS_APROVAM = new Set<PapelUsuario>([...PAPEIS_ESCRITORIO, PapelUsuario.SUPERVISOR]);

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

type Reembolso = {
  tipo: TipoReembolso;
  data: string;
  registradoPor: string;
  quantidadeCaixas?: number;
  loteId?: string;
  lote?: string;
  valor?: number;
  formaPagamento?: string;
  perda?: { quantidade: number; lote: string; valor: number };
};

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
  // Quem aprovou ou negou a solicitação
  analisadoPor?: string;
  analisadoEm?: string;
  reembolso?: Reembolso;
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
      obj.status === StatusDevolucao.APROVADA ||
      obj.status === StatusDevolucao.CONCLUIDA ||
      obj.status === StatusDevolucao.NEGADA
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
      analisadoPor: obj.analisadoPor ? String(obj.analisadoPor) : undefined,
      analisadoEm: obj.analisadoEm ? String(obj.analisadoEm) : undefined,
      reembolso: obj.reembolso && typeof obj.reembolso === 'object' ? obj.reembolso : undefined,
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
        analisadoPor: detalhes.analisadoPor ?? null,
        analisadoEm: detalhes.analisadoEm ?? null,
        reembolso: detalhes.reembolso ?? null,
        fotos: detalhes.fotos,
        criadoEm: log.data,
        registradoPor: log.usuario?.nome ?? null,
      };
    });
  }

  // Vendedor vê os pedidos que vendeu, motorista os que entregou; supervisor e escritório, todos
  private filtroDoUsuario(usuarioId: string, papel: PapelUsuario): Prisma.PedidoWhereInput {
    if (papel === PapelUsuario.MOTORISTA) return { entregadorId: usuarioId };
    if (PAPEIS_APROVAM.has(papel)) return {};
    return { vendedorId: usuarioId };
  }

  private pertenceAoUsuario(
    pedido: { vendedorId: string | null; entregadorId: string | null },
    usuarioId: string,
    papel: PapelUsuario,
  ) {
    if (papel === PapelUsuario.MOTORISTA) return pedido.entregadorId === usuarioId;
    if (PAPEIS_APROVAM.has(papel)) return true;
    return pedido.vendedorId === usuarioId;
  }

  // A etiqueta dá acesso ao endereço e ao telefone do cliente: o revendedor não recebe
  private semEtiquetaParaRevendedor<T extends { etiquetaId: unknown; etiquetaToken: unknown }>(
    item: T,
    papel: PapelUsuario,
  ) {
    return papel === PapelUsuario.REVENDEDOR
      ? { ...item, etiquetaId: null, etiquetaToken: null }
      : item;
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
    return pedidos.map((p) => this.semEtiquetaParaRevendedor(this.resumoPedido(p), papel));
  }

  async criar(dto: CriarDevolucaoDto, usuarioId: string, papel: PapelUsuario) {
    this.garantirPapel(papel);
    const semFoto = PAPEIS_ESCRITORIO.has(papel);
    const fotos = semFoto ? [] : (dto.fotos ?? []);
    if (!semFoto && fotos.length !== 3) {
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
    for (const foto of fotos) {
      if (!foto?.startsWith('data:image/')) {
        throw new BadRequestException('Uma das fotos é inválida');
      }
      fotosUrl.push(await this.storage.salvarDataUrl(foto));
    }

    // Motorista e vendedor solicitam; supervisor e escritório registram já aprovada
    const direta = PAPEIS_APROVAM.has(papel);

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
      status: direta ? StatusDevolucao.APROVADA : StatusDevolucao.PENDENTE,
      analisadoPor: direta ? await this.nomeUsuario(usuarioId) : undefined,
      analisadoEm: direta ? new Date().toISOString() : undefined,
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
    return this.semEtiquetaParaRevendedor(item, papel);
  }

  async listarMinhas(usuarioId: string, papel: PapelUsuario) {
    const logs = await this.prisma.logAuditoria.findMany({
      where: { acao: ACAO_DEVOLUCAO, usuarioId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { data: 'desc' },
    });
    const itens = await this.enrich(logs);
    return itens.map((item) => this.semEtiquetaParaRevendedor(item, papel));
  }

  async buscarPedidoPorEtiqueta(tokenRaw: string, usuarioId: string, papel: PapelUsuario) {
    this.garantirPapel(papel);
    const pedido = await this.carregarPedido({ etiquetaToken: tokenRaw }, usuarioId, papel);
    return this.semEtiquetaParaRevendedor(this.resumoPedido(pedido), papel);
  }

  async listarTodas() {
    const logs = await this.prisma.logAuditoria.findMany({
      where: { acao: ACAO_DEVOLUCAO },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { data: 'desc' },
    });
    return this.enrich(logs);
  }

  private async nomeUsuario(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { nome: true },
    });
    return usuario?.nome ?? 'Usuário';
  }

  // Aprovar não mexe em pedido nem estoque: isso acontece ao registrar o reembolso
  async atualizarStatus(id: string, dto: AtualizarStatusDevolucaoDto, usuarioId: string) {
    const log = await this.prisma.logAuditoria.findUnique({ where: { id } });
    if (!log || log.acao !== ACAO_DEVOLUCAO) {
      throw new NotFoundException('Devolução não encontrada');
    }

    const base = this.toDetalhes(log.detalhes);
    if (base.status !== StatusDevolucao.PENDENTE) {
      throw new BadRequestException('Esta solicitação já foi analisada');
    }

    const atualizados: DevolucaoDetalhes = {
      ...base,
      status: dto.status,
      resposta: dto.resposta?.trim() || undefined,
      analisadoPor: await this.nomeUsuario(usuarioId),
      analisadoEm: new Date().toISOString(),
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

  // Conclui a devolução. As caixas devolvidas viram perda: não voltam ao estoque.
  // Em dinheiro: o pedido é reduzido e o valor perdido é o informado.
  // Em caixas: o pedido não muda; a reposição sai do lote escolhido e o custo dela é a perda.
  async registrarReembolso(id: string, dto: RegistrarReembolsoDto, usuarioId: string) {
    const log = await this.prisma.logAuditoria.findUnique({ where: { id } });
    if (!log || log.acao !== ACAO_DEVOLUCAO) {
      throw new NotFoundException('Devolução não encontrada');
    }

    const base = this.toDetalhes(log.detalhes);
    if (base.status !== StatusDevolucao.APROVADA) {
      throw new BadRequestException('Só é possível registrar reembolso de devolução aprovada');
    }

    const reembolso: Reembolso = {
      tipo: dto.tipo,
      data: dataEfetiva(dto.data, 'Data do reembolso').toISOString(),
      registradoPor: await this.nomeUsuario(usuarioId),
    };

    await this.prisma.$transaction(async (tx) => {
      const lotePerda = await tx.loteProduto.findUnique({ where: { id: dto.perdaLoteId } });
      if (!lotePerda || !base.itens.some((item) => item.produtoId === lotePerda.produtoId)) {
        throw new BadRequestException('O lote da perda precisa ser de um produto desta devolução');
      }

      let custoReposicao = 0;
      if (dto.tipo === TipoReembolso.DINHEIRO) {
        if (!dto.valor || !dto.formaPagamento) {
          throw new BadRequestException('Informe o valor e a forma de pagamento do reembolso');
        }
        reembolso.valor = dto.valor;
        reembolso.formaPagamento = dto.formaPagamento;
        await this.aplicarDevolucaoNoPedido(tx, log.entidadeId, base);
      } else {
        if (!dto.quantidadeCaixas || !dto.loteId) {
          throw new BadRequestException('Informe a quantidade e o lote das caixas do reembolso');
        }
        const lote = await tx.loteProduto.findUnique({ where: { id: dto.loteId } });
        if (!lote || !base.itens.some((item) => item.produtoId === lote.produtoId)) {
          throw new BadRequestException('O lote precisa ser de um produto desta devolução');
        }
        const quantidade = dto.quantidadeCaixas;
        custoReposicao = quantidade * Number(lote.valorUnitario);
        const origem = `Reembolso em caixas do pedido ${base.pedidoNumero ?? ''}`.trim();
        const movimentacao = await tx.movimentacaoEstoque.create({
          data: {
            produtoId: lote.produtoId,
            tipo: TipoMovimentacao.SAIDA,
            quantidade: -quantidade,
            origem,
            pedidoId: log.entidadeId,
            usuarioId,
          },
        });
        await this.estoque.baixarLoteEmTx(tx, {
          loteId: lote.id,
          produtoId: lote.produtoId,
          quantidade,
          movimentacaoId: movimentacao.id,
          origem,
        });

        reembolso.quantidadeCaixas = quantidade;
        reembolso.loteId = lote.id;
        reembolso.lote = lote.numero;
      }

      const valorPerda =
        dto.tipo === TipoReembolso.DINHEIRO ? (dto.perdaValor ?? 0) : custoReposicao;
      await tx.perdaDevolucao.create({
        data: {
          devolucaoId: id,
          pedidoId: log.entidadeId,
          loteId: lotePerda.id,
          quantidade: dto.perdaQuantidade,
          valor: valorPerda,
          data: new Date(reembolso.data),
          usuarioId,
        },
      });
      reembolso.perda = {
        quantidade: dto.perdaQuantidade,
        lote: lotePerda.numero,
        valor: valorPerda,
      };

      await tx.logAuditoria.update({
        where: { id },
        data: {
          detalhes: {
            ...base,
            status: StatusDevolucao.CONCLUIDA,
            reembolso,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'REGISTRAR_REEMBOLSO_DEVOLUCAO',
          entidade: 'DevolucaoPedido',
          entidadeId: log.entidadeId,
          detalhes: { devolucaoId: id, ...reembolso } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    const salvo = await this.prisma.logAuditoria.findUniqueOrThrow({
      where: { id },
      include: { usuario: { select: { id: true, nome: true } } },
    });
    const [item] = await this.enrich([salvo]);
    return item;
  }

  async perdas(dataInicio?: string, dataFim?: string) {
    const hoje = hojeEmBrasilia();
    const inicio = new Date(`${dataInicio || hoje}T00:00:00-03:00`);
    const fim = new Date(`${dataFim || hoje}T23:59:59.999-03:00`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException('Período inválido');
    }

    const perdas = await this.prisma.perdaDevolucao.findMany({
      where: { data: { gte: inicio, lte: fim } },
      include: {
        pedido: {
          select: { numero: true, cliente: { select: { razaoSocialOuNome: true } } },
        },
        lote: { select: { numero: true, produto: { select: { nome: true } } } },
      },
      orderBy: { data: 'desc' },
    });

    const itens = perdas.map((p) => ({
      id: p.id,
      data: p.data,
      numeroPedido: p.pedido.numero,
      cliente: p.pedido.cliente?.razaoSocialOuNome ?? null,
      produto: p.lote.produto.nome,
      lote: p.lote.numero,
      quantidade: Number(p.quantidade),
      valor: Number(p.valor),
    }));

    return {
      totalCaixas: itens.reduce((acc, p) => acc + p.quantidade, 0),
      valorTotal: itens.reduce((acc, p) => acc + p.valor, 0),
      itens,
    };
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
      aprovadas: 0,
      concluidas: 0,
      negadas: 0,
      totalCaixas: 0,
      valorTotal: 0,
    };

    for (const log of logs) {
      const detalhes = this.toDetalhes(log.detalhes);
      const status = detalhes.status;
      if (status === StatusDevolucao.CONCLUIDA) resumo.concluidas += 1;
      else if (status === StatusDevolucao.APROVADA) resumo.aprovadas += 1;
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
    tx: Prisma.TransactionClient,
    pedidoId: string,
    devolucao: DevolucaoDetalhes,
  ) {
    if (!devolucao.itens.length) {
      throw new BadRequestException('Não há itens devolvidos para aplicar no pedido');
    }

    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      include: { itens: true },
    });
    if (!pedido) throw new NotFoundException('Pedido da devolução não encontrado');

    const mapaDevolucao = new Map(
      devolucao.itens.map((item) => [item.produtoId, Number(item.quantidade)]),
    );

    // Produto dividido entre lotes: a devolução é distribuída pelas linhas do produto.
    // As caixas saem do pedido, mas não voltam ao lote: são registradas como perda
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

        await this.estoque.retirarDoPedidoEmTx(tx, {
          pedidoId,
          produtoId,
          quantidade: qtdDevolvida,
          loteIdPreferido: item.loteId,
        });
      }
    }

    await this.recalcularTotais(tx, pedidoId);
  }

  private async recalcularTotais(tx: Prisma.TransactionClient, pedidoId: string) {
    const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
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
  }
}
