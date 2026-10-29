import { BadRequestException, Injectable } from '@nestjs/common';
import { PapelUsuario, Prisma, StatusPedido, TipoEntidadeEndereco } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { GeocodificacaoService } from '../common/geocodificacao.service';
import { hojeEmBrasilia } from '../common/data-efetiva';

const STATUS_PENDENTES: StatusPedido[] = [
  StatusPedido.APROVADO,
  StatusPedido.EM_SEPARACAO,
  StatusPedido.PRONTO_PARA_ENTREGA,
  StatusPedido.EM_ENTREGA,
];

// Motorista sem pedido no dia ainda aparece se mandou posição há pouco
const POSICAO_RECENTE_MS = 30 * 60 * 1000;

const INCLUDE_PEDIDO = {
  cliente: { select: { id: true, razaoSocialOuNome: true, nomeFantasia: true } },
  entregador: { select: { id: true, nome: true, papel: true } },
  historicoStatus: {
    where: { status: StatusPedido.PRONTO_PARA_ENTREGA },
    orderBy: { alteradoEm: 'desc' as const },
    take: 1,
    select: { alteradoEm: true },
  },
} satisfies Prisma.PedidoInclude;

type PedidoRota = Prisma.PedidoGetPayload<{ include: typeof INCLUDE_PEDIDO }>;

function textoEndereco(e: any) {
  if (!e) return '';
  const cidade = e.cidade?.nome ?? '';
  const uf = e.cidade?.estado?.sigla ?? '';
  return [e.logradouro, e.numero, e.bairro, cidade && uf ? `${cidade}/${uf}` : cidade]
    .filter(Boolean)
    .join(', ');
}

@Injectable()
export class EntregasService {
  constructor(
    private prisma: PrismaService,
    private geocodificacao: GeocodificacaoService,
  ) {}

  // Ordem da rota: a caminho primeiro, depois a ordem definida pelo supervisor e, sem ela,
  // a ordem em que os pedidos ficaram prontos
  private ordenar(a: PedidoRota, b: PedidoRota) {
    const caminho = (p: PedidoRota) => (p.status === StatusPedido.EM_ENTREGA ? 0 : 1);
    if (caminho(a) !== caminho(b)) return caminho(a) - caminho(b);
    const ordemA = a.ordemRota ?? Number.MAX_SAFE_INTEGER;
    const ordemB = b.ordemRota ?? Number.MAX_SAFE_INTEGER;
    if (ordemA !== ordemB) return ordemA - ordemB;
    const prontoA = (a.historicoStatus[0]?.alteradoEm ?? a.data).getTime();
    const prontoB = (b.historicoStatus[0]?.alteradoEm ?? b.data).getTime();
    return prontoA - prontoB;
  }

  async acompanhamento() {
    const inicioDoDia = new Date(`${hojeEmBrasilia()}T00:00:00-03:00`);
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        entregadorId: { not: null },
        OR: [
          { status: { in: STATUS_PENDENTES } },
          { status: StatusPedido.ENTREGUE, entregueEm: { gte: inicioDoDia } },
        ],
      },
      include: INCLUDE_PEDIDO,
    });

    // Endereço de entrega de cada cliente (o de entrega, senão o principal)
    const clienteIds = [...new Set(pedidos.map((p) => p.clienteId))];
    const enderecos = clienteIds.length
      ? await this.prisma.endereco.findMany({
          where: { entidadeTipo: TipoEntidadeEndereco.CLIENTE, entidadeId: { in: clienteIds } },
          include: { cidade: { include: { estado: true } } },
          orderBy: [{ principal: 'desc' }, { criadoEm: 'asc' }],
        })
      : [];
    const enderecoDoCliente = new Map<string, (typeof enderecos)[number]>();
    for (const id of clienteIds) {
      const doCliente = enderecos.filter((e) => e.entidadeId === id);
      const escolhido =
        doCliente.find((e) => e.tipo === 'ENTREGA') ??
        doCliente.find((e) => e.principal) ??
        doCliente[0];
      if (escolhido) enderecoDoCliente.set(id, escolhido);
    }
    // Pendentes primeiro: são os que importam no mapa
    const ordemGeo = [
      ...pedidos.filter((p) => p.status !== StatusPedido.ENTREGUE),
      ...pedidos.filter((p) => p.status === StatusPedido.ENTREGUE),
    ]
      .map((p) => enderecoDoCliente.get(p.clienteId))
      .filter((e): e is NonNullable<typeof e> => !!e);
    this.geocodificacao.agendar([...new Set(ordemGeo)]);

    const localizacoes = await this.prisma.localizacaoMotorista.findMany({
      include: { usuario: { select: { id: true, nome: true, ativo: true, papel: true } } },
    });

    const motoristas = new Map<
      string,
      { id: string; nome: string; pendentes: PedidoRota[]; entregues: PedidoRota[] }
    >();
    for (const p of pedidos) {
      const ent = p.entregador!;
      const grupo = motoristas.get(ent.id) ?? {
        id: ent.id,
        nome: ent.nome,
        pendentes: [],
        entregues: [],
      };
      if (p.status === StatusPedido.ENTREGUE) grupo.entregues.push(p);
      else grupo.pendentes.push(p);
      motoristas.set(ent.id, grupo);
    }
    for (const loc of localizacoes) {
      const recente = Date.now() - loc.atualizadoEm.getTime() < POSICAO_RECENTE_MS;
      const entrega =
        loc.usuario.papel === PapelUsuario.MOTORISTA ||
        loc.usuario.papel === PapelUsuario.SUPERVISOR;
      if (!motoristas.has(loc.usuarioId) && recente && loc.usuario.ativo && entrega) {
        motoristas.set(loc.usuarioId, {
          id: loc.usuarioId,
          nome: loc.usuario.nome,
          pendentes: [],
          entregues: [],
        });
      }
    }

    const formatar = (p: PedidoRota) => {
      const e = enderecoDoCliente.get(p.clienteId);
      return {
        id: p.id,
        numero: p.numero,
        status: p.status,
        cliente: p.cliente.nomeFantasia || p.cliente.razaoSocialOuNome,
        endereco: textoEndereco(e),
        latitude: e?.latitude ?? null,
        longitude: e?.longitude ?? null,
        ordemRota: p.ordemRota,
        entregueEm: p.entregueEm,
      };
    };

    return [...motoristas.values()]
      .map((m) => {
        const loc = localizacoes.find((l) => l.usuarioId === m.id);
        const pendentes = [...m.pendentes].sort((a, b) => this.ordenar(a, b));
        const entregues = [...m.entregues].sort(
          (a, b) => (b.entregueEm?.getTime() ?? 0) - (a.entregueEm?.getTime() ?? 0),
        );
        const atual = pendentes.find((p) => p.status === StatusPedido.EM_ENTREGA) ?? null;
        return {
          motorista: { id: m.id, nome: m.nome },
          localizacao: loc
            ? {
                latitude: loc.latitude,
                longitude: loc.longitude,
                precisao: loc.precisao,
                atualizadoEm: loc.atualizadoEm,
              }
            : null,
          emEntrega: atual ? formatar(atual) : null,
          proximos: pendentes.filter((p) => p !== atual).map(formatar),
          entregues: entregues.map(formatar),
          total: pendentes.length + entregues.length,
          concluidas: entregues.length,
        };
      })
      .sort(
        (a, b) =>
          b.total - b.concluidas - (a.total - a.concluidas) ||
          a.motorista.nome.localeCompare(b.motorista.nome),
      );
  }

  async definirOrdem(pedidoIds: string[]) {
    const ids = [...new Set(pedidoIds)];
    const pedidos = await this.prisma.pedido.findMany({
      where: { id: { in: ids } },
      select: { id: true, entregadorId: true, status: true },
    });
    if (pedidos.length !== ids.length) throw new BadRequestException('Pedido não encontrado');
    const entregadores = new Set(pedidos.map((p) => p.entregadorId));
    if (entregadores.size !== 1 || !pedidos[0].entregadorId) {
      throw new BadRequestException('A rota precisa ser de um único entregador');
    }
    if (pedidos.some((p) => !STATUS_PENDENTES.includes(p.status))) {
      throw new BadRequestException('Só pedidos ainda não entregues entram na ordem da rota');
    }
    await this.prisma.$transaction(
      ids.map((id, indice) =>
        this.prisma.pedido.update({ where: { id }, data: { ordemRota: indice + 1 } }),
      ),
    );
    return { ok: true };
  }
}
