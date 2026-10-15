import { BadRequestException, Injectable } from '@nestjs/common';
import { PapelUsuario, StatusPedido } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { calcularMetasDoMes, diasDoMes } from './metas.calc';
import { DefinirValorMetaDto, MarcarDiaSemMetaDto } from './dto/meta.dto';

// O dia da meta é o dia de Brasília (o servidor roda em UTC).
const FUSO = 'America/Sao_Paulo';
const OFFSET = '-03:00';
const MES = /^\d{4}-\d{2}$/;

function dataEmBrasilia(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d); // YYYY-MM-DD
}

/** Coluna DATE do Postgres vem como meia-noite UTC */
function dataDoBanco(d: Date) {
  return d.toISOString().slice(0, 10);
}

function paraColunaData(data: string) {
  return new Date(`${data}T00:00:00Z`);
}

@Injectable()
export class MetasService {
  constructor(private prisma: PrismaService) {}

  /** Lucro por dia (Brasília) com a mesma regra do painel: vendido - custo, sem cancelados/rejeitados */
  private async lucroPorDia(inicio: string, fim: string) {
    const itens = await this.prisma.itemPedido.findMany({
      where: {
        pedido: {
          status: { notIn: [StatusPedido.CANCELADO, StatusPedido.REJEITADO] },
          data: {
            gte: new Date(`${inicio}T00:00:00${OFFSET}`),
            lte: new Date(`${fim}T23:59:59.999${OFFSET}`),
          },
        },
      },
      select: {
        quantidade: true,
        valorTotal: true,
        pedido: { select: { data: true } },
        produto: { select: { custo: true } },
      },
    });

    const porDia = new Map<string, number>();
    for (const item of itens) {
      const dia = dataEmBrasilia(item.pedido.data);
      const lucro =
        Number(item.valorTotal) - Number(item.produto.custo ?? 0) * Number(item.quantidade);
      porDia.set(dia, (porDia.get(dia) ?? 0) + lucro);
    }
    return porDia;
  }

  async mes(mesParam?: string) {
    const hoje = dataEmBrasilia(new Date());
    const mesAtual = hoje.slice(0, 7);
    const mes = mesParam ?? mesAtual;
    if (!MES.test(mes)) throw new BadRequestException('mes deve estar no formato AAAA-MM');

    // meses futuros ainda não têm dias para calcular
    const dias = mes > mesAtual ? [] : diasDoMes(mes, mes === mesAtual ? hoje : undefined);
    if (dias.length === 0) {
      return { mes, hoje, dias: [], resumo: { diasComMeta: 0, diasAtingidos: 0, lucroTotal: 0 } };
    }

    const inicio = dias[0];
    const fim = dias[dias.length - 1];
    const [valores, semMeta, lucroPorDia] = await Promise.all([
      this.prisma.metaValor.findMany({
        where: { vigenteDesde: { lte: paraColunaData(fim) } },
        orderBy: [{ vigenteDesde: 'asc' }, { criadoEm: 'asc' }],
      }),
      this.prisma.metaDiaSemMeta.findMany({
        where: { data: { gte: paraColunaData(inicio), lte: paraColunaData(fim) } },
      }),
      this.lucroPorDia(inicio, fim),
    ]);

    const resultado = calcularMetasDoMes({
      dias,
      hoje,
      valores: valores.map((v) => ({
        valor: Number(v.valor),
        vigenteDesde: dataDoBanco(v.vigenteDesde),
      })),
      diasSemMeta: new Set(semMeta.map((d) => dataDoBanco(d.data))),
      lucroPorDia,
    });

    const motivos = new Map(semMeta.map((d) => [dataDoBanco(d.data), d.motivo]));
    const diasComMeta = resultado.filter((d) => d.temMeta && !d.emAndamento);

    return {
      mes,
      hoje,
      dias: resultado.map((d) => ({ ...d, motivo: motivos.get(d.data) ?? null })),
      resumo: {
        diasComMeta: diasComMeta.length,
        diasAtingidos: diasComMeta.filter((d) => d.atingida).length,
        lucroTotal: Math.round(resultado.reduce((acc, d) => acc + d.lucro, 0) * 100) / 100,
      },
    };
  }

  async hoje(papel: PapelUsuario) {
    const { hoje, dias } = await this.mes();
    const dia = dias.find((d) => d.data === hoje);
    const percentual =
      dia && dia.temMeta && dia.meta > 0 ? Math.min(100, (dia.lucro / dia.meta) * 100) : 0;

    // Vendedor não vê valores financeiros da empresa (escopo, item 3.1): só o progresso.
    if (papel === PapelUsuario.VENDEDOR) {
      return {
        data: hoje,
        temMeta: !!dia?.temMeta,
        motivoSemMeta: dia?.motivoSemMeta ?? null,
        percentual: Math.round(percentual),
        atingida: !!dia?.atingida,
        temAcumulado: (dia?.acumulado ?? 0) > 0,
      };
    }

    return { ...dia, data: hoje, percentual: Math.round(percentual * 10) / 10 };
  }

  async valores() {
    const valores = await this.prisma.metaValor.findMany({
      orderBy: [{ vigenteDesde: 'desc' }, { criadoEm: 'desc' }],
      take: 30,
    });
    return valores.map((v) => ({
      id: v.id,
      valor: Number(v.valor),
      vigenteDesde: dataDoBanco(v.vigenteDesde),
      criadoEm: v.criadoEm,
    }));
  }

  async definirValor(dto: DefinirValorMetaDto, usuarioId: string) {
    const vigenteDesde = dto.vigenteDesde ?? dataEmBrasilia(new Date());
    const data = paraColunaData(vigenteDesde);

    // Um valor por data: redefinir no mesmo dia substitui o anterior
    const existente = await this.prisma.metaValor.findFirst({ where: { vigenteDesde: data } });
    if (existente) {
      await this.prisma.metaValor.update({
        where: { id: existente.id },
        data: { valor: dto.valor, criadoPorId: usuarioId },
      });
    } else {
      await this.prisma.metaValor.create({
        data: { valor: dto.valor, vigenteDesde: data, criadoPorId: usuarioId },
      });
    }
    return this.valores();
  }

  async removerValor(id: string) {
    await this.prisma.metaValor.deleteMany({ where: { id } });
    return this.valores();
  }

  async diasSemMeta(mes?: string) {
    const ref = mes ?? dataEmBrasilia(new Date()).slice(0, 7);
    if (!MES.test(ref)) throw new BadRequestException('mes deve estar no formato AAAA-MM');
    const dias = diasDoMes(ref);
    const lista = await this.prisma.metaDiaSemMeta.findMany({
      where: {
        data: { gte: paraColunaData(dias[0]), lte: paraColunaData(dias[dias.length - 1]) },
      },
      orderBy: { data: 'asc' },
    });
    return lista.map((d) => ({ data: dataDoBanco(d.data), motivo: d.motivo }));
  }

  async marcarDiaSemMeta(dto: MarcarDiaSemMetaDto) {
    const data = paraColunaData(dto.data);
    await this.prisma.metaDiaSemMeta.upsert({
      where: { data },
      update: { motivo: dto.motivo ?? null },
      create: { data, motivo: dto.motivo ?? null },
    });
    return { ok: true };
  }

  async desmarcarDiaSemMeta(data: string) {
    await this.prisma.metaDiaSemMeta.deleteMany({ where: { data: paraColunaData(data) } });
    return { ok: true };
  }
}
