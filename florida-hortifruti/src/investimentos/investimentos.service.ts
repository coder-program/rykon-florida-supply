import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { dataEfetiva } from '../common/data-efetiva';
import { RegistrarDevolucaoInvestimentoDto, SalvarInvestimentoDto } from './dto/investimento.dto';

type InvestimentoComDevolucoes = Prisma.InvestimentoGetPayload<{
  include: { devolucoes: true };
}>;

const INCLUDE = {
  devolucoes: { orderBy: { data: 'asc' as const } },
} satisfies Prisma.InvestimentoInclude;

const centavos = (v: number) => Math.round(v * 100);

@Injectable()
export class InvestimentosService {
  constructor(private prisma: PrismaService) {}

  private formatar(inv: InvestimentoComDevolucoes) {
    const valor = Number(inv.valor);
    const devolvido = inv.devolucoes.reduce((acc, d) => acc + Number(d.valor), 0);
    const restante = Math.max(0, (centavos(valor) - centavos(devolvido)) / 100);
    const status = restante <= 0 ? 'DEVOLVIDO' : devolvido > 0 ? 'PARCIAL' : 'FALTA_DEVOLVER';
    return {
      id: inv.id,
      nome: inv.nome,
      data: inv.data,
      valor,
      motivo: inv.motivo,
      valorDevolvido: Number(devolvido.toFixed(2)),
      valorRestante: restante,
      status,
      // Quando terminou de devolver: data da última devolução
      devolvidoEm: status === 'DEVOLVIDO' ? (inv.devolucoes.at(-1)?.data ?? null) : null,
      devolucoes: inv.devolucoes.map((d) => ({
        id: d.id,
        valor: Number(d.valor),
        data: d.data,
        observacao: d.observacao,
      })),
    };
  }

  async listar() {
    const lista = await this.prisma.investimento.findMany({
      include: INCLUDE,
      orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
    });
    return lista.map((inv) => this.formatar(inv));
  }

  private async buscar(id: string) {
    const inv = await this.prisma.investimento.findUnique({ where: { id }, include: INCLUDE });
    if (!inv) throw new NotFoundException('Investimento não encontrado');
    return inv;
  }

  async criar(dto: SalvarInvestimentoDto, usuarioId: string) {
    const inv = await this.prisma.investimento.create({
      data: {
        nome: dto.nome.trim(),
        data: dataEfetiva(dto.data, 'Data do aporte'),
        valor: dto.valor,
        motivo: dto.motivo.trim(),
        usuarioId,
      },
      include: INCLUDE,
    });
    return this.formatar(inv);
  }

  async atualizar(id: string, dto: SalvarInvestimentoDto) {
    const atual = await this.buscar(id);
    const devolvido = atual.devolucoes.reduce((acc, d) => acc + Number(d.valor), 0);
    if (centavos(dto.valor) < centavos(devolvido)) {
      throw new BadRequestException(
        `O valor não pode ficar abaixo do que já foi devolvido (${devolvido.toFixed(2)})`,
      );
    }
    const inv = await this.prisma.investimento.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        data: dataEfetiva(dto.data, 'Data do aporte'),
        valor: dto.valor,
        motivo: dto.motivo.trim(),
      },
      include: INCLUDE,
    });
    return this.formatar(inv);
  }

  async remover(id: string) {
    await this.buscar(id);
    await this.prisma.investimento.delete({ where: { id } });
    return { ok: true };
  }

  async registrarDevolucao(id: string, dto: RegistrarDevolucaoInvestimentoDto, usuarioId: string) {
    const inv = this.formatar(await this.buscar(id));
    if (centavos(dto.valor) > centavos(inv.valorRestante)) {
      throw new BadRequestException(
        `O valor passa do que falta devolver (${inv.valorRestante.toFixed(2)})`,
      );
    }
    await this.prisma.devolucaoInvestimento.create({
      data: {
        investimentoId: id,
        valor: dto.valor,
        data: dataEfetiva(dto.data, 'Data da devolução'),
        observacao: dto.observacao?.trim() || null,
        usuarioId,
      },
    });
    return this.formatar(await this.buscar(id));
  }

  async removerDevolucao(id: string, devolucaoId: string) {
    const devolucao = await this.prisma.devolucaoInvestimento.findUnique({
      where: { id: devolucaoId },
    });
    if (!devolucao || devolucao.investimentoId !== id) {
      throw new NotFoundException('Devolução não encontrada');
    }
    await this.prisma.devolucaoInvestimento.delete({ where: { id: devolucaoId } });
    return this.formatar(await this.buscar(id));
  }
}
