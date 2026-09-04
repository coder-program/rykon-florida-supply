import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FormaPagamento, OrigemPedido, TipoEntidadeEndereco } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { ProdutosService } from '../produtos/produtos.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { ClientesService } from '../clientes/clientes.service';
import { CriarPedidoPortalDto } from '../pedidos/dto/pedido.dto';

@Injectable()
export class PortalClienteService {
  constructor(
    private prisma: PrismaService,
    private pedidosService: PedidosService,
    private produtosService: ProdutosService,
    private enderecos: EnderecosService,
    private clientes: ClientesService,
  ) {}

  private exibirPreco() {
    return process.env.PORTAL_CLIENTE_EXIBIR_PRECO !== 'false';
  }

  async resolverCliente(usuarioId: string) {
    return this.clientes.findByUsuarioId(usuarioId);
  }

  async catalogo(usuarioId: string) {
    const cliente = await this.resolverCliente(usuarioId);
    const produtos = await this.prisma.produto.findMany({
      where: { ativo: true, exibirNoPortalCliente: true },
      include: { categoria: true },
      orderBy: { nome: 'asc' },
    });
    const ids = produtos.map((p) => p.id);
    const [saldos, precos] = await Promise.all([
      ids.length
        ? this.prisma.movimentacaoEstoque.groupBy({
            by: ['produtoId'],
            where: { produtoId: { in: ids } },
            _sum: { quantidade: true },
          })
        : [],
      this.prisma.precoCliente.findMany({
        where: { clienteId: cliente.id, produtoId: { in: ids } },
      }),
    ]);
    const saldoMap = new Map<string, number>(
      (Array.isArray(saldos) ? saldos : []).map((s: any) => [
        s.produtoId,
        Number(s._sum?.quantidade ?? 0),
      ]),
    );
    const precoMap = new Map<string, number>(
      precos.map((p) => [p.produtoId, Number(p.precoUnitario)]),
    );
    const mostrarPreco = this.exibirPreco();

    return produtos.map((p) => {
      const estoqueAtual = saldoMap.get(p.id) ?? 0;
      const disponibilidade = ProdutosService.disponibilidade(
        estoqueAtual,
        p.limiteEstoqueBaixo != null ? Number(p.limiteEstoqueBaixo) : null,
        p.estoqueMinimo != null ? Number(p.estoqueMinimo) : null,
      );
      return {
        id: p.id,
        nome: p.nome,
        unidadeVenda: p.unidadeVenda,
        categoria: p.categoria,
        disponibilidade,
        quantidadeAproximada: p.exibirQuantidadeAproximada ? estoqueAtual : null,
        preco: mostrarPreco ? (precoMap.get(p.id) ?? Number(p.precoSugerido)) : null,
      };
    });
  }

  async criarPedido(usuarioId: string, dto: CriarPedidoPortalDto) {
    const cliente = await this.resolverCliente(usuarioId);
    if (!cliente.ativo) throw new ForbiddenException('Cliente inativo');
    if (!dto.itens?.length) throw new BadRequestException('Inclua pelo menos um produto');

    const ids = dto.itens.map((i) => i.produtoId);
    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: ids }, ativo: true, exibirNoPortalCliente: true },
    });
    const precos = await this.prisma.precoCliente.findMany({
      where: { clienteId: cliente.id, produtoId: { in: ids } },
    });
    const precoMap = new Map(precos.map((p) => [p.produtoId, Number(p.precoUnitario)]));

    const itens = dto.itens.map((item) => {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) throw new BadRequestException('Produto indisponível no catálogo');
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorUnitario: precoMap.get(item.produtoId) ?? Number(produto.precoSugerido),
      };
    });

    const forma =
      dto.formaPagamento ||
      (cliente.formaPagamentoUsual &&
      ['PIX', 'BOLETO', 'DINHEIRO', 'OUTROS'].includes(cliente.formaPagamentoUsual)
        ? (cliente.formaPagamentoUsual as FormaPagamento)
        : FormaPagamento.PIX);

    const pedido = await this.pedidosService.create(
      {
        clienteId: cliente.id,
        itens,
        formaPagamento: forma,
        observacoes: dto.observacoes,
        necessitaNF: cliente.necessitaNF,
      },
      null,
      { origem: OrigemPedido.CLIENTE, clienteId: cliente.id },
    );
    return this.detalhe(pedido.id, usuarioId);
  }

  async listarPedidos(usuarioId: string) {
    const cliente = await this.resolverCliente(usuarioId);
    const pedidos = await this.prisma.pedido.findMany({
      where: { clienteId: cliente.id },
      include: {
        itens: { include: { produto: { select: { nome: true, unidadeVenda: true } } } },
      },
      orderBy: { criadoEm: 'desc' },
    });
    return pedidos.map((p) => this.resumo(p));
  }

  async detalhe(id: string, usuarioId: string) {
    const cliente = await this.resolverCliente(usuarioId);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        itens: { include: { produto: { select: { id: true, nome: true, unidadeVenda: true } } } },
        comprovanteEntrega: {
          select: { nomeRecebedor: true, dataHora: true, fotoUrl: true },
        },
      },
    });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.clienteId !== cliente.id) {
      throw new ForbiddenException('Você não tem acesso a este pedido');
    }
    return this.resumo(pedido);
  }

  async atualizarPedido(id: string, usuarioId: string, dto: CriarPedidoPortalDto) {
    const cliente = await this.resolverCliente(usuarioId);
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (pedido.clienteId !== cliente.id) {
      throw new ForbiddenException('Você não tem acesso a este pedido');
    }
    if (pedido.status !== 'AGUARDANDO_APROVACAO') {
      throw new BadRequestException(
        'Só é possível alterar o pedido enquanto ele aguarda aprovação',
      );
    }
    if (!dto.itens?.length)
      throw new BadRequestException('O pedido precisa ter pelo menos um produto');

    const ids = dto.itens.map((i) => i.produtoId);
    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: ids }, ativo: true, exibirNoPortalCliente: true },
    });
    const precos = await this.prisma.precoCliente.findMany({
      where: { clienteId: cliente.id, produtoId: { in: ids } },
    });
    const precoMap = new Map(precos.map((p) => [p.produtoId, Number(p.precoUnitario)]));

    const itens = dto.itens.map((item) => {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) throw new BadRequestException('Produto indisponível no catálogo');
      return {
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        valorUnitario: precoMap.get(item.produtoId) ?? Number(produto.precoSugerido),
      };
    });

    await this.pedidosService.atualizarItensAntesAprovacao(id, itens, usuarioId);
    if (dto.observacoes !== undefined) {
      await this.prisma.pedido.update({
        where: { id },
        data: { observacoes: dto.observacoes.trim() || null },
      });
    }
    return this.detalhe(id, usuarioId);
  }

  async conta(usuarioId: string) {
    const cliente = await this.resolverCliente(usuarioId);
    const enderecos = await this.enderecos.findByEntidade(TipoEntidadeEndereco.CLIENTE, cliente.id);
    return {
      id: cliente.id,
      razaoSocialOuNome: cliente.razaoSocialOuNome,
      nomeFantasia: cliente.nomeFantasia,
      cnpjCpf: cliente.cnpjCpf,
      telefone: cliente.telefone,
      whatsapp: cliente.whatsapp,
      email: cliente.email,
      enderecos,
    };
  }

  private resumo(p: any) {
    return {
      id: p.id,
      numero: p.numero,
      status: p.status,
      origem: p.origem,
      data: p.data,
      observacoes: p.observacoes,
      totalEstimado: this.exibirPreco() ? Number(p.totalFinal) : null,
      itens: p.itens.map((i: any) => ({
        produtoId: i.produtoId ?? i.produto?.id,
        nome: i.produto?.nome,
        unidadeVenda: i.produto?.unidadeVenda,
        quantidade: Number(i.quantidade),
        valorUnitario: this.exibirPreco() ? Number(i.valorUnitario) : null,
      })),
      comprovante: p.comprovanteEntrega ?? null,
    };
  }
}
