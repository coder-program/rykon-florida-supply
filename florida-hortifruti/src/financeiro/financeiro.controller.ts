import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PapelUsuario, FormaPagamento } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FinanceiroService } from './financeiro.service';
import { RegistrarPagamentoDto } from './dto/financeiro.dto';

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

  @Post('marcar-pago/:pedidoId')
  marcarPago(@Param('pedidoId') pedidoId: string, @Request() req: any) {
    return this.financeiroService.marcarPago(pedidoId, req.user.id);
  }

  // Pagamento total ou parcial de um pedido a prazo - saldo devedor é recalculado automaticamente
  @Post('pagamento/:pedidoId')
  registrarPagamento(
    @Param('pedidoId') pedidoId: string,
    @Body() dto: RegistrarPagamentoDto,
    @Request() req: any,
  ) {
    return this.financeiroService.registrarPagamento(pedidoId, dto, req.user.id);
  }

  @Post('reabrir/:pedidoId')
  reabrir(@Param('pedidoId') pedidoId: string, @Request() req: any) {
    return this.financeiroService.reabrir(pedidoId, req.user.id);
  }

  @Post('notificacoes-vencimento')
  gerarNotificacoesVencimento() {
    return this.financeiroService.gerarNotificacoesVencimento();
  }
}
