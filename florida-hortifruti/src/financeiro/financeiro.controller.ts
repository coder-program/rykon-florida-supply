import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PapelUsuario, FormaPagamento } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FinanceiroService } from './financeiro.service';
import { MarcarPagoDto, RegistrarPagamentoDto } from './dto/financeiro.dto';

@Controller('financeiro')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
export class FinanceiroController {
  constructor(private financeiroService: FinanceiroService) {}

  @Get('resumo')
  resumo(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.financeiroService.resumo(dataInicio, dataFim);
  }

  @Get('contas-a-receber')
  contasAReceber(
    @Query('vendedorId') vendedorId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('formaPagamento') formaPagamento?: FormaPagamento,
    @Query('situacao') situacao?: 'EM_ABERTO' | 'VENCIDO' | 'PAGO' | 'A_VENCER',
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.financeiroService.contasAReceber({
      vendedorId,
      clienteId,
      formaPagamento,
      situacao,
      dataInicio,
      dataFim,
    });
  }

  // Quitação total. Vendedor só nos próprios pedidos (validado no service)
  @Post('marcar-pago/:pedidoId')
  @Roles(
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VENDEDOR,
  )
  marcarPago(@Param('pedidoId') pedidoId: string, @Body() dto: MarcarPagoDto, @Request() req: any) {
    return this.financeiroService.marcarPago(pedidoId, req.user.id, req.user.papel, dto?.data);
  }

  // Pagamento total ou parcial de um pedido a prazo - saldo devedor é recalculado automaticamente.
  // Parcial: financeiro e supervisor; o vendedor usa a quitação total
  @Post('pagamento/:pedidoId')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR, PapelUsuario.SUPERVISOR)
  registrarPagamento(
    @Param('pedidoId') pedidoId: string,
    @Body() dto: RegistrarPagamentoDto,
    @Request() req: any,
  ) {
    return this.financeiroService.registrarPagamento(pedidoId, dto, req.user.id, req.user.papel);
  }

  @Post('reabrir/:pedidoId')
  reabrir(@Param('pedidoId') pedidoId: string, @Request() req: any) {
    return this.financeiroService.reabrir(pedidoId, req.user.id);
  }

  @Post('notificacoes-vencimento')
  gerarNotificacoesVencimento() {
    return this.financeiroService.gerarNotificacoesVencimento();
  }

  @Get('notificacoes')
  listarNotificacoes(@Query('status') status?: string, @Query('clienteId') clienteId?: string) {
    return this.financeiroService.listarNotificacoes({ status, clienteId });
  }

  @Post('notificacoes/:id/enviada')
  marcarNotificacaoEnviada(@Param('id') id: string) {
    return this.financeiroService.marcarNotificacaoEnviada(id);
  }
}
