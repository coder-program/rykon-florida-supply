import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EstoqueService } from './estoque.service';
import {
  EntradaEstoqueDto,
  AjusteEstoqueDto,
  AtualizarLoteDto,
  AtualizarCompraDto,
} from './dto/estoque.dto';

@Controller('estoque')
@UseGuards(JwtAuthGuard, RolesGuard)
// Supervisor (comprador) registra a entrada dos lotes
@Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR, PapelUsuario.SUPERVISOR) // regra 4 do escopo
export class EstoqueController {
  constructor(private estoqueService: EstoqueService) {}

  @Post('entrada')
  registrarEntrada(@Body() dto: EntradaEstoqueDto, @Request() req: any) {
    const bruto =
      Array.isArray(dto.itens) && dto.itens.length
        ? dto.itens
        : Array.isArray(req.body?.itens)
          ? req.body.itens
          : [];

    const itens = bruto.length
      ? bruto.map((item: any) => ({
          produtoId: String(item.produtoId ?? ''),
          quantidade: Number(item.quantidade),
          valorProduto: Number(item.valorProduto ?? item.custoTotal ?? 0),
          numeroLote: item.numeroLote != null ? String(item.numeroLote) : undefined,
          precoSugeridoVenda:
            item.precoSugeridoVenda != null && Number(item.precoSugeridoVenda) > 0
              ? Number(item.precoSugeridoVenda)
              : undefined,
        }))
      : dto.produtoId
        ? [
            {
              produtoId: dto.produtoId,
              quantidade: Number(dto.quantidade),
              valorProduto:
                Number(dto.quantidade) > 0
                  ? Number(dto.custoTotal ?? 0) / Number(dto.quantidade)
                  : Number(dto.custoTotal ?? 0),
            },
          ]
        : [];

    return this.estoqueService.registrarEntrada({
      fornecedorId: dto.fornecedorId,
      fornecedor: dto.fornecedor,
      valorFrete: dto.valorFrete,
      valorComissao: dto.valorComissao,
      observacao: dto.observacao,
      numeroLote: dto.numeroLote,
      dataLote: dto.dataLote,
      itens,
      usuarioId: req.user.id,
    });
  }

  @Get('compras/:id')
  compra(@Param('id') id: string) {
    return this.estoqueService.buscarCompra(id);
  }

  // Frete/comissão lançados depois: recalcula o custo da caixa de cada lote da compra
  @Patch('compras/:id')
  atualizarCompra(@Param('id') id: string, @Body() dto: AtualizarCompraDto, @Request() req: any) {
    return this.estoqueService.atualizarCompra(id, dto, req.user.id);
  }

  @Post('ajuste')
  registrarAjuste(@Body() dto: AjusteEstoqueDto, @Request() req: any) {
    return this.estoqueService.registrarAjuste({ ...dto, usuarioId: req.user.id });
  }

  @Get('saldos')
  saldosTodos() {
    return this.estoqueService.saldosTodos();
  }

  // Aba Lotes: todos os lotes com saldo, quanto já foi vendido e em quais pedidos
  @Get('lotes')
  listarLotes(
    @Query('produtoId') produtoId?: string,
    @Query('situacao') situacao?: 'DISPONIVEL' | 'ESGOTADO',
  ) {
    return this.estoqueService.listarLotes({ produtoId, situacao });
  }

  // O vendedor escolhe o lote ao montar o pedido (só número, data e saldo; sem custo)
  @Get('lotes/disponiveis')
  @Roles(
    PapelUsuario.VENDEDOR,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.REVENDEDOR,
  )
  async lotesDisponiveis(@Request() req: any, @Query('produtoId') produtoId?: string) {
    const lotes = await this.estoqueService.lotesDisponiveis(produtoId);
    // Preço sugerido sai do custo da Flórida: o revendedor vê só as caixas
    return req.user.papel === PapelUsuario.REVENDEDOR
      ? lotes.map((l) => ({ ...l, precoSugeridoVenda: null }))
      : lotes;
  }

  @Get('lotes/proximo-numero')
  proximoNumeroLote(@Query('data') data?: string) {
    return this.estoqueService.sugerirNumeroLote(data);
  }

  @Patch('lotes/:id')
  atualizarLote(@Param('id') id: string, @Body() dto: AtualizarLoteDto) {
    return this.estoqueService.atualizarLote(id, dto);
  }

  // Extrato do lote: entrada, vendas, devoluções e ajustes com saldo antes/depois
  @Get('lotes/:id/historico')
  historicoLote(@Param('id') id: string) {
    return this.estoqueService.historicoLote(id);
  }

  @Get('lotes/:produtoId')
  lotesProduto(@Param('produtoId') produtoId: string) {
    return this.estoqueService.listarLotesProduto(produtoId);
  }

  // Rastreabilidade: quais lotes (e quantidades) foram usados em um pedido específico
  @Get('pedido/:pedidoId/lotes')
  lotesUtilizadosNoPedido(@Param('pedidoId') pedidoId: string) {
    return this.estoqueService.lotesUtilizadosNoPedido(pedidoId);
  }

  @Get(':produtoId/saldo')
  saldo(@Param('produtoId') produtoId: string) {
    return this.estoqueService.saldoAtual(produtoId);
  }

  @Get(':produtoId/historico')
  historico(@Param('produtoId') produtoId: string) {
    return this.estoqueService.historico(produtoId);
  }
}
