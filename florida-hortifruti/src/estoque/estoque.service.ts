import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, TipoMovimentacao } from '@prisma/client';

type ItemEntrada = {
  produtoId: string;
  quantidade: number;
  valorProduto: number;
  numeroLote?: string;
};

@Injectable()
export class EstoqueService {
  constructor(private prisma: PrismaService) {}

  private toCents(value: number) {
    return Math.round(Number(value) * 100);
  }

  private fromCents(cents: number) {
    return Number((cents / 100).toFixed(2));
  }

  calcularRateio(itens: ItemEntrada[], valorFrete = 0, valorComissao = 0) {
    const freteCents = this.toCents(valorFrete || 0);
    const comissaoCents = this.toCents(valorComissao || 0);
    const valoresCents = itens.map((item) =>
      this.toCents(Number(item.quantidade || 0) * Number(item.valorProduto || 0)),
    );
    const totalCents = valoresCents.reduce((acc, value) => acc + value, 0);

    let usadoFrete = 0;
    let usadoComissao = 0;

    return itens.map((item, index) => {
      const ultimo = index === itens.length - 1;
      const peso = totalCents > 0 ? valoresCents[index] / totalCents : 1 / itens.length;
      const rateioFreteCents = ultimo ? freteCents - usadoFrete : Math.round(freteCents * peso);
      const rateioComissaoCents = ultimo
        ? comissaoCents - usadoComissao
        : Math.round(comissaoCents * peso);

      usadoFrete += rateioFreteCents;
      usadoComissao += rateioComissaoCents;

      const valorProduto = this.fromCents(valoresCents[index]);
      const rateioFrete = this.fromCents(rateioFreteCents);
      const rateioComissao = this.fromCents(rateioComissaoCents);
      const custoTotalItem = Number((valorProduto + rateioFrete + rateioComissao).toFixed(2));
      const custoUnitarioFinal = Number((custoTotalItem / item.quantidade).toFixed(4));

      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorProdutoInformado: valorProduto,
        rateioFrete,
        rateioComissao,
        custoTotalItem,
        custoUnitarioFinal,
      };
    });
  }

  // Dia do lote no fuso de Brasília (YYYY-MM-DD) e o intervalo [início, fim) desse dia
  private diaLote(data?: string) {
    const dia =
      data && /^\d{4}-\d{2}-\d{2}$/.test(data)
        ? data
        : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const inicio = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(inicio.getTime() + 86400000);
    // Meio-dia evita que a data "pule" de dia ao ser exibida em outro fuso
    const dataEntrada = data ? new Date(`${dia}T12:00:00-03:00`) : new Date();
    return { inicio, fim, dataEntrada };
  }

  // Próximo número sequencial do dia: 18/09 - lote 1, lote 2...
  private async proximoNumeroLote(
    tx: Prisma.TransactionClient | PrismaService,
    inicio: Date,
    fim: Date,
  ) {
    const lotes = await tx.loteProduto.findMany({
      where: { dataEntrada: { gte: inicio, lt: fim } },
      select: { numero: true },
    });
    const maior = lotes.reduce((acc, lote) => {
      const n = Number(lote.numero);
      return Number.isInteger(n) && n > acc ? n : acc;
    }, 0);
    return String(maior + 1);
  }

  async sugerirNumeroLote(data?: string) {
    const { inicio, fim } = this.diaLote(data);
    return { numero: await this.proximoNumeroLote(this.prisma, inicio, fim) };
  }

  async registrarEntrada(params: {
    fornecedor: string;
    usuarioId: string;
    itens: ItemEntrada[];
    valorFrete?: number;
    valorComissao?: number;
    observacao?: string;
    numeroLote?: string;
    dataLote?: string;
  }) {
    const itens = (params.itens ?? []).filter((item) => item.produtoId && item.quantidade > 0);
    if (itens.length === 0) {
      throw new BadRequestException('Informe pelo menos um produto na compra');
    }

    const ids = [...new Set(itens.map((item) => item.produtoId))];
    const produtos = await this.prisma.produto.findMany({ where: { id: { in: ids } } });
    if (produtos.length !== ids.length) {
      throw new BadRequestException('Um ou mais produtos da compra não existem');
    }

    const valorFrete = Number(params.valorFrete ?? 0);
    const valorComissao = Number(params.valorComissao ?? 0);
    const rateados = this.calcularRateio(itens, valorFrete, valorComissao);
    const { inicio, fim, dataEntrada } = this.diaLote(params.dataLote);

    return this.prisma.$transaction(async (tx) => {
      const numeroPadrao =
        params.numeroLote?.trim() || (await this.proximoNumeroLote(tx, inicio, fim));

      const vistos = new Set<string>();
      for (const item of itens) {
        const numero = item.numeroLote?.trim() || numeroPadrao;
        const chave = `${item.produtoId}|${numero}`;
        if (vistos.has(chave)) {
          throw new BadRequestException(
            `O mesmo produto aparece duas vezes no lote ${numero}; junte as quantidades em uma linha`,
          );
        }
        vistos.add(chave);
        const repetido = await tx.loteProduto.findFirst({
          where: {
            produtoId: item.produtoId,
            numero,
            dataEntrada: { gte: inicio, lt: fim },
          },
          include: { produto: { select: { nome: true } } },
        });
        if (repetido) {
          throw new BadRequestException(
            `Já existe o lote ${numero} de ${repetido.produto.nome} nesse dia`,
          );
        }
      }

      const compra = await tx.compraEstoque.create({
        data: {
          fornecedor: params.fornecedor,
          valorFrete,
          valorComissao,
          observacao: params.observacao,
          usuarioId: params.usuarioId,
        },
      });

      for (const [index, item] of rateados.entries()) {
        const movimentacao = await tx.movimentacaoEstoque.create({
          data: {
            produtoId: item.produtoId,
            tipo: TipoMovimentacao.ENTRADA,
            quantidade: item.quantidade,
            origem: `Compra - ${params.fornecedor}`,
            fornecedor: params.fornecedor,
            custoTotal: item.custoTotalItem,
            custoUnitario: item.custoUnitarioFinal,
            usuarioId: params.usuarioId,
            observacao: params.observacao,
          },
        });

        const numeroLote = itens[index]?.numeroLote?.trim() || numeroPadrao;

        const lote = await tx.loteProduto.create({
          data: {
            produtoId: item.produtoId,
            numero: numeroLote,
            dataEntrada,
            quantidadeInicial: item.quantidade,
            quantidadeDisponivel: item.quantidade,
            valorUnitario: item.custoUnitarioFinal,
            observacao: params.observacao,
          },
        });

        await tx.movimentacaoEstoqueLote.create({
          data: {
            loteId: lote.id,
            movimentacaoId: movimentacao.id,
            quantidade: item.quantidade,
            saldoAntes: 0,
            saldoDepois: item.quantidade,
            origem: `Compra - ${params.fornecedor}`,
          },
        });

        await tx.itemCompraEstoque.create({
          data: {
            compraId: compra.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            valorProdutoInformado: item.valorProdutoInformado,
            rateioFrete: item.rateioFrete,
            rateioComissao: item.rateioComissao,
            custoUnitarioFinal: item.custoUnitarioFinal,
            movimentacaoId: movimentacao.id,
          },
        });

        await tx.produto.update({
          where: { id: item.produtoId },
          data: { custo: item.custoUnitarioFinal },
        });
      }

      return tx.compraEstoque.findUnique({
        where: { id: compra.id },
        include: {
          itens: {
            include: { produto: { select: { nome: true, codigoInterno: true } } },
          },
        },
      });
    });
  }

  private async carregarCompra(tx: Prisma.TransactionClient | PrismaService, id: string) {
    const compra = await tx.compraEstoque.findUnique({
      where: { id },
      include: {
        usuario: { select: { nome: true } },
        itens: {
          orderBy: { id: 'asc' },
          include: {
            produto: { select: { id: true, nome: true, codigoInterno: true } },
            movimentacao: {
              select: {
                lotes: {
                  take: 1,
                  orderBy: { data: 'asc' },
                  select: {
                    lote: {
                      select: {
                        id: true,
                        numero: true,
                        dataEntrada: true,
                        quantidadeInicial: true,
                        quantidadeDisponivel: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!compra) throw new NotFoundException('Entrada de estoque não encontrada');
    return compra;
  }

  // Entrada de estoque com seus itens e o lote gerado por cada item
  async buscarCompra(id: string) {
    const compra = await this.carregarCompra(this.prisma, id);
    return {
      id: compra.id,
      fornecedor: compra.fornecedor,
      valorFrete: Number(compra.valorFrete),
      valorComissao: Number(compra.valorComissao),
      observacao: compra.observacao,
      data: compra.data,
      usuario: compra.usuario?.nome ?? null,
      itens: compra.itens.map((item) => {
        const quantidade = Number(item.quantidade);
        const valorProduto = Number(item.valorProdutoInformado);
        const lote = item.movimentacao?.lotes[0]?.lote;
        return {
          id: item.id,
          produto: item.produto,
          quantidade,
          valorUnitario: quantidade > 0 ? Number((valorProduto / quantidade).toFixed(4)) : 0,
          valorProduto,
          rateioFrete: Number(item.rateioFrete),
          rateioComissao: Number(item.rateioComissao),
          custoUnitarioFinal: Number(item.custoUnitarioFinal),
          lote: lote
            ? {
                id: lote.id,
                numero: lote.numero,
                dataEntrada: lote.dataEntrada,
                quantidadeVendida: Number(
                  (Number(lote.quantidadeInicial) - Number(lote.quantidadeDisponivel)).toFixed(2),
                ),
              }
            : null,
        };
      }),
    };
  }

  // Frete e comissão costumam ser pagos depois da compra (às vezes com o lote já vendido).
  // Refaz o rateio e atualiza o custo da caixa no item, na movimentação de entrada, no lote
  // e no produto (se esta for a entrada mais recente dele). O lucro das vendas já registradas
  // é calculado na consulta, então acompanha o novo custo.
  async atualizarCompra(
    id: string,
    dados: {
      fornecedor?: string;
      valorFrete?: number;
      valorComissao?: number;
      observacao?: string;
      itens?: Array<{ id: string; valorProduto?: number }>;
    },
    usuarioId: string,
  ) {
    const compra = await this.carregarCompra(this.prisma, id);
    if (compra.itens.length === 0) {
      throw new BadRequestException('Esta entrada não tem itens para recalcular');
    }

    const fornecedor = dados.fornecedor?.trim() || compra.fornecedor;
    const valorFrete =
      dados.valorFrete !== undefined ? Number(dados.valorFrete) : Number(compra.valorFrete);
    const valorComissao =
      dados.valorComissao !== undefined
        ? Number(dados.valorComissao)
        : Number(compra.valorComissao);
    const observacao =
      dados.observacao !== undefined ? dados.observacao.trim() || null : compra.observacao;

    const editados = new Map((dados.itens ?? []).map((item) => [item.id, item.valorProduto]));
    for (const itemId of editados.keys()) {
      if (!compra.itens.some((item) => item.id === itemId)) {
        throw new BadRequestException('Item não pertence a esta entrada');
      }
    }

    const entrada: ItemEntrada[] = compra.itens.map((item) => {
      const quantidade = Number(item.quantidade);
      const editado = editados.get(item.id);
      return {
        produtoId: item.produtoId,
        quantidade,
        valorProduto:
          editado !== undefined && editado !== null
            ? Number(editado)
            : quantidade > 0
              ? Number(item.valorProdutoInformado) / quantidade
              : 0,
      };
    });
    if (entrada.some((item) => !(item.valorProduto >= 0))) {
      throw new BadRequestException('Valor do produto inválido');
    }
    const rateados = this.calcularRateio(entrada, valorFrete, valorComissao);

    const antes = {
      fornecedor: compra.fornecedor,
      valorFrete: Number(compra.valorFrete),
      valorComissao: Number(compra.valorComissao),
      itens: compra.itens.map((item) => ({
        produto: item.produto.nome,
        valorProduto: Number(item.valorProdutoInformado),
        custoUnitarioFinal: Number(item.custoUnitarioFinal),
      })),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.compraEstoque.update({
        where: { id },
        data: { fornecedor, valorFrete, valorComissao, observacao },
      });

      for (const [index, item] of compra.itens.entries()) {
        const novo = rateados[index];
        await tx.itemCompraEstoque.update({
          where: { id: item.id },
          data: {
            valorProdutoInformado: novo.valorProdutoInformado,
            rateioFrete: novo.rateioFrete,
            rateioComissao: novo.rateioComissao,
            custoUnitarioFinal: novo.custoUnitarioFinal,
          },
        });

        if (!item.movimentacaoId) continue;
        await tx.movimentacaoEstoque.update({
          where: { id: item.movimentacaoId },
          data: {
            fornecedor,
            origem: `Compra - ${fornecedor}`,
            custoTotal: novo.custoTotalItem,
            custoUnitario: novo.custoUnitarioFinal,
            observacao,
          },
        });

        const lote = item.movimentacao?.lotes[0]?.lote;
        if (lote) {
          await tx.loteProduto.update({
            where: { id: lote.id },
            data: { valorUnitario: novo.custoUnitarioFinal },
          });
        }

        // Custo do produto = custo da entrada mais recente (mesma regra do "Custo caixa")
        const ultimaEntrada = await tx.movimentacaoEstoque.findFirst({
          where: {
            produtoId: item.produtoId,
            tipo: TipoMovimentacao.ENTRADA,
            custoUnitario: { not: null },
          },
          orderBy: { data: 'desc' },
          select: { id: true },
        });
        if (ultimaEntrada?.id === item.movimentacaoId) {
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { custo: novo.custoUnitarioFinal },
          });
        }
      }

      await tx.logAuditoria.create({
        data: {
          usuarioId,
          acao: 'EDITAR_ENTRADA_ESTOQUE',
          entidade: 'CompraEstoque',
          entidadeId: id,
          detalhes: {
            antes,
            depois: {
              fornecedor,
              valorFrete,
              valorComissao,
              itens: compra.itens.map((item, index) => ({
                produto: item.produto.nome,
                valorProduto: rateados[index].valorProdutoInformado,
                custoUnitarioFinal: rateados[index].custoUnitarioFinal,
              })),
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.buscarCompra(id);
  }

  async validarDisponibilidade(
    itens: { produtoId: string; quantidade: number; loteId?: string | null }[],
  ) {
    await this.validarLotesEscolhidos(itens);

    const porProduto = new Map<string, number>();
    for (const item of itens) {
      porProduto.set(
        item.produtoId,
        (porProduto.get(item.produtoId) ?? 0) + Number(item.quantidade || 0),
      );
    }

    const faltando: string[] = [];

    for (const [produtoId, quantidade] of porProduto) {
      const lotes = await this.prisma.loteProduto.findMany({
        where: { produtoId, ativo: true, quantidadeDisponivel: { gt: 0 } },
        orderBy: [{ dataEntrada: 'asc' }, { criadoEm: 'asc' }],
        select: { quantidadeDisponivel: true, numero: true },
      });

      const disponivel = lotes.reduce(
        (acc, lote) => acc + Number(lote.quantidadeDisponivel ?? 0),
        0,
      );

      if (disponivel < quantidade) {
        const produto = await this.prisma.produto.findUnique({
          where: { id: produtoId },
          select: { nome: true },
        });

        faltando.push(
          `${produto?.nome ?? produtoId} (pedido ${quantidade} cx, estoque em lotes ${disponivel} cx)`,
        );
      }
    }

    if (faltando.length > 0) {
      throw new BadRequestException(`Sem estoque suficiente: ${faltando.join('; ')}`);
    }
  }

  // Lote escolhido pelo vendedor precisa ser do produto e ter saldo para a quantidade pedida
  private async validarLotesEscolhidos(
    itens: { produtoId: string; quantidade: number; loteId?: string | null }[],
  ) {
    const porLote = new Map<string, { produtoId: string; quantidade: number }>();
    for (const item of itens) {
      if (!item.loteId) continue;
      const atual = porLote.get(item.loteId);
      if (atual && atual.produtoId !== item.produtoId) {
        throw new BadRequestException('O mesmo lote foi escolhido para produtos diferentes');
      }
      porLote.set(item.loteId, {
        produtoId: item.produtoId,
        quantidade: (atual?.quantidade ?? 0) + Number(item.quantidade || 0),
      });
    }
    if (porLote.size === 0) return;

    const lotes = await this.prisma.loteProduto.findMany({
      where: { id: { in: [...porLote.keys()] } },
      include: { produto: { select: { nome: true } } },
    });
    const faltando: string[] = [];
    for (const [loteId, pedido] of porLote) {
      const lote = lotes.find((l) => l.id === loteId);
      if (!lote || !lote.ativo || lote.produtoId !== pedido.produtoId) {
        throw new BadRequestException('Lote escolhido não pertence ao produto ou foi encerrado');
      }
      const disponivel = Number(lote.quantidadeDisponivel ?? 0);
      if (disponivel < pedido.quantidade) {
        faltando.push(
          `${lote.produto.nome} lote ${lote.numero}: disponível ${disponivel} cx, pedido ${pedido.quantidade} cx`,
        );
      }
    }
    if (faltando.length > 0) {
      throw new BadRequestException(
        `Saldo insuficiente no lote. ${faltando.join('; ')}. Selecione outro lote ou divida a quantidade entre lotes.`,
      );
    }
  }

  async listarLotesProduto(produtoId: string) {
    return this.prisma.loteProduto.findMany({
      where: { produtoId, ativo: true },
      orderBy: [{ dataEntrada: 'asc' }, { criadoEm: 'asc' }],
    });
  }

  // Aba Lotes do admin: todos os lotes com quanto já saiu e em quais pedidos
  async listarLotes(filtros: { produtoId?: string; situacao?: 'DISPONIVEL' | 'ESGOTADO' }) {
    const where: Prisma.LoteProdutoWhereInput = {};
    if (filtros.produtoId) where.produtoId = filtros.produtoId;
    if (filtros.situacao === 'DISPONIVEL') where.quantidadeDisponivel = { gt: 0 };
    if (filtros.situacao === 'ESGOTADO') where.quantidadeDisponivel = { lte: 0 };

    const lotes = await this.prisma.loteProduto.findMany({
      where,
      include: {
        produto: { select: { id: true, nome: true, codigoInterno: true, unidadeVenda: true } },
        itensPedido: {
          select: {
            quantidade: true,
            pedido: {
              select: {
                id: true,
                numero: true,
                data: true,
                cliente: { select: { razaoSocialOuNome: true } },
              },
            },
          },
        },
        // Primeiro movimento do lote = a entrada; leva à compra para editar frete/comissão
        movimentacoesLote: {
          take: 1,
          orderBy: { data: 'asc' },
          select: { movimentacao: { select: { itemCompra: { select: { compraId: true } } } } },
        },
      },
      orderBy: [{ dataEntrada: 'desc' }, { criadoEm: 'desc' }],
      take: 500,
    });

    return lotes.map((lote) => {
      const inicial = Number(lote.quantidadeInicial);
      const disponivel = Number(lote.quantidadeDisponivel);
      return {
        id: lote.id,
        numero: lote.numero,
        dataEntrada: lote.dataEntrada,
        produto: lote.produto,
        quantidadeInicial: inicial,
        quantidadeDisponivel: disponivel,
        quantidadeVendida: Number((inicial - disponivel).toFixed(2)),
        valorUnitario: Number(lote.valorUnitario),
        observacao: lote.observacao,
        compraId: lote.movimentacoesLote[0]?.movimentacao.itemCompra?.compraId ?? null,
        vendas: lote.itensPedido.map((item) => ({
          pedidoId: item.pedido.id,
          numeroPedido: item.pedido.numero,
          data: item.pedido.data,
          cliente: item.pedido.cliente?.razaoSocialOuNome ?? null,
          quantidade: Number(item.quantidade),
        })),
      };
    });
  }

  // Para o vendedor escolher o lote no pedido: só lotes com saldo, sem mostrar custo
  async lotesDisponiveis(produtoId?: string) {
    const lotes = await this.prisma.loteProduto.findMany({
      where: {
        ativo: true,
        quantidadeDisponivel: { gt: 0 },
        ...(produtoId ? { produtoId } : {}),
      },
      select: {
        id: true,
        produtoId: true,
        numero: true,
        dataEntrada: true,
        quantidadeDisponivel: true,
      },
      orderBy: [{ dataEntrada: 'asc' }, { criadoEm: 'asc' }],
    });
    return lotes.map((lote) => ({
      ...lote,
      quantidadeDisponivel: Number(lote.quantidadeDisponivel),
    }));
  }

  async atualizarLote(id: string, dados: { numero?: string; observacao?: string }) {
    const lote = await this.prisma.loteProduto.findUnique({ where: { id } });
    if (!lote) throw new NotFoundException('Lote não encontrado');

    const numero = dados.numero?.trim();
    if (numero && numero !== lote.numero) {
      const dia = lote.dataEntrada.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const { inicio, fim } = this.diaLote(dia);
      const repetido = await this.prisma.loteProduto.findFirst({
        where: {
          id: { not: id },
          produtoId: lote.produtoId,
          numero,
          dataEntrada: { gte: inicio, lt: fim },
        },
      });
      if (repetido)
        throw new BadRequestException(`Já existe o lote ${numero} desse produto nesse dia`);
    }

    return this.prisma.loteProduto.update({
      where: { id },
      data: {
        ...(numero ? { numero } : {}),
        ...(dados.observacao !== undefined ? { observacao: dados.observacao || null } : {}),
      },
    });
  }

  private rotuloLote(lote: { numero: string; dataEntrada: Date }) {
    const data = lote.dataEntrada.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
    });
    return `${data} - lote ${lote.numero}`;
  }

  // Baixa do lote escolhido pelo usuário. Nunca troca de lote sozinho:
  // sem saldo suficiente, a operação é recusada para que outro lote seja escolhido.
  async baixarLoteEmTx(
    tx: Prisma.TransactionClient,
    params: {
      loteId: string;
      produtoId: string;
      quantidade: number;
      movimentacaoId: string;
      origem: string;
      // Venda: registra também em ItemPedidoLote (qual lote saiu em qual pedido)
      pedidoId?: string;
      valorUnitario?: number;
    },
  ) {
    const quantidade = Number(params.quantidade || 0);
    if (quantidade <= 0) return null;

    const lote = await tx.loteProduto.findUnique({
      where: { id: params.loteId },
      include: { produto: { select: { nome: true } } },
    });
    if (!lote || lote.produtoId !== params.produtoId) {
      throw new BadRequestException('Lote escolhido não pertence ao produto');
    }

    const saldoAntes = Number(lote.quantidadeDisponivel ?? 0);
    if (!lote.ativo || saldoAntes < quantidade) {
      throw new BadRequestException(
        `Saldo insuficiente no ${this.rotuloLote(lote)} de ${lote.produto.nome}: disponível ${saldoAntes} cx, pedido ${quantidade} cx. Selecione outro lote.`,
      );
    }
    const saldoDepois = Number((saldoAntes - quantidade).toFixed(2));

    await tx.loteProduto.update({
      where: { id: lote.id },
      data: { quantidadeDisponivel: saldoDepois },
    });
    await tx.movimentacaoEstoqueLote.create({
      data: {
        loteId: lote.id,
        movimentacaoId: params.movimentacaoId,
        quantidade,
        saldoAntes,
        saldoDepois,
        origem: params.origem,
      },
    });

    if (params.pedidoId) {
      const valorUnitario = Number(params.valorUnitario ?? 0);
      const existente = await tx.itemPedidoLote.findFirst({
        where: { pedidoId: params.pedidoId, loteId: lote.id },
      });
      if (existente) {
        const novaQtd = Number(existente.quantidade) + quantidade;
        await tx.itemPedidoLote.update({
          where: { id: existente.id },
          data: {
            quantidade: novaQtd,
            valorUnitario,
            valorTotal: Number((novaQtd * valorUnitario).toFixed(2)),
          },
        });
      } else {
        await tx.itemPedidoLote.create({
          data: {
            pedidoId: params.pedidoId,
            produtoId: params.produtoId,
            loteId: lote.id,
            quantidade,
            valorUnitario,
            valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
          },
        });
      }
    }

    return { loteId: lote.id, quantidade, saldoAntes, saldoDepois };
  }

  // Volta caixas para um lote (cancelamento, devolução, redução de pedido, ajuste positivo)
  async devolverAoLoteEmTx(
    tx: Prisma.TransactionClient,
    params: {
      loteId: string;
      quantidade: number;
      movimentacaoId: string;
      origem: string;
      pedidoId?: string;
    },
  ) {
    const quantidade = Number(params.quantidade || 0);
    if (quantidade <= 0) return null;

    const lote = await tx.loteProduto.findUnique({ where: { id: params.loteId } });
    if (!lote) throw new NotFoundException('Lote não encontrado');

    const saldoAntes = Number(lote.quantidadeDisponivel ?? 0);
    const saldoDepois = Number((saldoAntes + quantidade).toFixed(2));

    await tx.loteProduto.update({
      where: { id: lote.id },
      data: { quantidadeDisponivel: saldoDepois },
    });
    await tx.movimentacaoEstoqueLote.create({
      data: {
        loteId: lote.id,
        movimentacaoId: params.movimentacaoId,
        quantidade,
        saldoAntes,
        saldoDepois,
        origem: params.origem,
      },
    });

    // Mantém em ItemPedidoLote só o que ficou de fato com o cliente
    if (params.pedidoId) {
      const usado = await tx.itemPedidoLote.findFirst({
        where: { pedidoId: params.pedidoId, loteId: lote.id },
      });
      if (usado) {
        const resta = Number((Number(usado.quantidade) - quantidade).toFixed(2));
        if (resta <= 0) {
          await tx.itemPedidoLote.delete({ where: { id: usado.id } });
        } else {
          await tx.itemPedidoLote.update({
            where: { id: usado.id },
            data: {
              quantidade: resta,
              valorTotal: Number((resta * Number(usado.valorUnitario)).toFixed(2)),
            },
          });
        }
      }
    }

    return { loteId: lote.id, quantidade, saldoAntes, saldoDepois };
  }

  // Devolve ao(s) lote(s) de onde as caixas do pedido saíram: primeiro o lote indicado,
  // depois os demais lotes usados para o mesmo produto (pedidos antigos com baixa automática)
  async devolverDoPedidoEmTx(
    tx: Prisma.TransactionClient,
    params: {
      pedidoId: string;
      produtoId: string;
      quantidade: number;
      movimentacaoId: string;
      origem: string;
      loteIdPreferido?: string | null;
    },
  ) {
    let restante = Number(params.quantidade || 0);
    const usados = await tx.itemPedidoLote.findMany({
      where: { pedidoId: params.pedidoId, produtoId: params.produtoId },
      orderBy: { id: 'asc' },
    });
    usados.sort(
      (a, b) =>
        Number(b.loteId === params.loteIdPreferido) - Number(a.loteId === params.loteIdPreferido),
    );

    for (const usado of usados) {
      if (restante <= 0) break;
      const qtd = Math.min(restante, Number(usado.quantidade));
      if (qtd <= 0) continue;
      await this.devolverAoLoteEmTx(tx, {
        loteId: usado.loteId,
        quantidade: qtd,
        movimentacaoId: params.movimentacaoId,
        origem: params.origem,
        pedidoId: params.pedidoId,
      });
      restante = Number((restante - qtd).toFixed(2));
    }
    // Sobra sem lote de origem conhecido (pedido anterior ao controle por lote): só o saldo do produto volta
    return restante;
  }

  // Rastreabilidade de um pedido: cada movimento de lote (saída, devolução) com saldo antes/depois,
  // e o resumo do que ficou com o cliente por lote
  async lotesUtilizadosNoPedido(pedidoId: string) {
    const [movimentos, resumo] = await Promise.all([
      this.prisma.movimentacaoEstoqueLote.findMany({
        where: { movimentacao: { pedidoId } },
        include: {
          lote: {
            select: {
              id: true,
              numero: true,
              dataEntrada: true,
              produto: { select: { id: true, nome: true } },
            },
          },
        },
        orderBy: [{ data: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.itemPedidoLote.findMany({
        where: { pedidoId },
        include: {
          produto: { select: { nome: true, codigoInterno: true } },
          lote: { select: { numero: true, dataEntrada: true } },
        },
        orderBy: [{ produtoId: 'asc' }, { lote: { dataEntrada: 'asc' } }],
      }),
    ]);

    return {
      resumo: resumo.map((item) => ({
        produtoId: item.produtoId,
        produtoNome: item.produto.nome,
        codigoInterno: item.produto.codigoInterno,
        loteId: item.loteId,
        loteNumero: item.lote.numero,
        loteData: item.lote.dataEntrada,
        quantidade: Number(item.quantidade),
        valorUnitario: Number(item.valorUnitario),
        valorTotal: Number(item.valorTotal),
      })),
      movimentos: movimentos.map((m) => this.formatarMovimentoLote(m)),
    };
  }

  private formatarMovimentoLote(m: {
    id: string;
    data: Date;
    origem: string;
    quantidade: Prisma.Decimal;
    saldoAntes: Prisma.Decimal | null;
    saldoDepois: Prisma.Decimal | null;
    lote?: {
      id: string;
      numero: string;
      dataEntrada: Date;
      produto: { id: string; nome: string };
    };
  }) {
    const antes = m.saldoAntes != null ? Number(m.saldoAntes) : null;
    const depois = m.saldoDepois != null ? Number(m.saldoDepois) : null;
    return {
      id: m.id,
      data: m.data,
      origem: m.origem,
      quantidade: Number(m.quantidade),
      tipo: antes != null && depois != null && depois > antes ? 'ENTRADA' : 'SAIDA',
      saldoAntes: antes,
      saldoDepois: depois,
      ...(m.lote
        ? {
            loteId: m.lote.id,
            loteNumero: m.lote.numero,
            loteData: m.lote.dataEntrada,
            produtoId: m.lote.produto.id,
            produtoNome: m.lote.produto.nome,
          }
        : {}),
    };
  }

  // Extrato de um lote: entrada, cada venda (com pedido e cliente), devoluções e ajustes
  async historicoLote(loteId: string) {
    const lote = await this.prisma.loteProduto.findUnique({
      where: { id: loteId },
      include: { produto: { select: { id: true, nome: true } } },
    });
    if (!lote) throw new NotFoundException('Lote não encontrado');

    const movimentos = await this.prisma.movimentacaoEstoqueLote.findMany({
      where: { loteId },
      include: {
        movimentacao: {
          select: {
            motivoAjuste: true,
            usuario: { select: { nome: true } },
            pedido: {
              select: {
                id: true,
                numero: true,
                cliente: { select: { razaoSocialOuNome: true } },
              },
            },
          },
        },
      },
      orderBy: [{ data: 'asc' }, { id: 'asc' }],
    });

    return {
      lote: {
        id: lote.id,
        numero: lote.numero,
        dataEntrada: lote.dataEntrada,
        produto: lote.produto,
        quantidadeInicial: Number(lote.quantidadeInicial),
        quantidadeDisponivel: Number(lote.quantidadeDisponivel),
      },
      movimentos: movimentos.map((m) => ({
        ...this.formatarMovimentoLote(m),
        pedidoId: m.movimentacao.pedido?.id ?? null,
        numeroPedido: m.movimentacao.pedido?.numero ?? null,
        cliente: m.movimentacao.pedido?.cliente?.razaoSocialOuNome ?? null,
        motivoAjuste: m.movimentacao.motivoAjuste,
        usuario: m.movimentacao.usuario?.nome ?? null,
      })),
    };
  }

  async registrarSaida(params: {
    produtoId: string;
    quantidade: number;
    pedidoId: string;
    numeroPedido: number;
    usuarioId: string;
  }) {
    return this.prisma.movimentacaoEstoque.create({
      data: {
        produtoId: params.produtoId,
        tipo: TipoMovimentacao.SAIDA,
        quantidade: -Math.abs(params.quantidade),
        origem: `Pedido ${params.numeroPedido}`,
        pedidoId: params.pedidoId,
        usuarioId: params.usuarioId,
      },
    });
  }

  // Ajuste manual sempre num lote escolhido, para o saldo do lote acompanhar o do produto
  async registrarAjuste(params: {
    produtoId: string;
    quantidade: number;
    motivo: string;
    usuarioId: string;
    observacao?: string;
    loteId?: string;
  }) {
    const quantidade = Number(params.quantidade);
    const loteId = params.loteId;
    if (!quantidade) throw new BadRequestException('Informe uma quantidade diferente de zero');
    if (!loteId) throw new BadRequestException('Selecione o lote do ajuste');

    return this.prisma.$transaction(async (tx) => {
      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          produtoId: params.produtoId,
          tipo: TipoMovimentacao.AJUSTE,
          quantidade,
          origem: 'Ajuste manual',
          motivoAjuste: params.motivo,
          usuarioId: params.usuarioId,
          observacao: params.observacao,
        },
      });

      const origem = `Ajuste manual - ${params.motivo}`;
      if (quantidade > 0) {
        const lote = await tx.loteProduto.findUnique({ where: { id: loteId } });
        if (!lote || lote.produtoId !== params.produtoId) {
          throw new BadRequestException('Lote escolhido não pertence ao produto');
        }
        await this.devolverAoLoteEmTx(tx, {
          loteId,
          quantidade,
          movimentacaoId: movimentacao.id,
          origem,
        });
      } else {
        await this.baixarLoteEmTx(tx, {
          loteId,
          produtoId: params.produtoId,
          quantidade: Math.abs(quantidade),
          movimentacaoId: movimentacao.id,
          origem,
        });
      }
      return movimentacao;
    });
  }

  async saldoAtual(produtoId: string) {
    const resultado = await this.prisma.movimentacaoEstoque.aggregate({
      where: { produtoId },
      _sum: { quantidade: true },
    });
    return resultado._sum.quantidade ?? 0;
  }

  async saldosTodos() {
    const produtos = await this.prisma.produto.findMany({ where: { ativo: true } });
    const saldos = await Promise.all(
      produtos.map(async (p) => {
        const [resultado, ultimaEntrada] = await Promise.all([
          this.prisma.movimentacaoEstoque.aggregate({
            where: { produtoId: p.id },
            _sum: { quantidade: true },
          }),
          this.prisma.movimentacaoEstoque.findFirst({
            where: {
              produtoId: p.id,
              tipo: TipoMovimentacao.ENTRADA,
              custoUnitario: { not: null },
            },
            orderBy: { data: 'desc' },
            select: { custoUnitario: true },
          }),
        ]);
        const saldoAtual = Number(resultado._sum.quantidade ?? 0);
        const estoqueMinimo = p.estoqueMinimo ? Number(p.estoqueMinimo) : null;
        return {
          produtoId: p.id,
          codigoInterno: p.codigoInterno,
          nome: p.nome,
          saldoAtual,
          unidadeVenda: p.unidadeVenda,
          estoqueMinimo,
          abaixoMinimo: estoqueMinimo !== null && saldoAtual < estoqueMinimo,
          custoCaixa:
            ultimaEntrada?.custoUnitario != null
              ? Number(ultimaEntrada.custoUnitario)
              : p.custo != null
                ? Number(p.custo)
                : null,
        };
      }),
    );
    return saldos;
  }

  historico(produtoId: string) {
    return this.prisma.movimentacaoEstoque.findMany({
      where: { produtoId },
      include: {
        usuario: { select: { nome: true } },
        itemCompra: {
          include: {
            compra: {
              include: {
                itens: {
                  include: {
                    produto: { select: { id: true, nome: true, codigoInterno: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { data: 'desc' },
    });
  }
}
