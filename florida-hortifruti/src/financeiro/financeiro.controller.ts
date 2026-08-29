import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PapelUsuario, FormaPagamento } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FinanceiroService } from './financeiro.service';

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
    return this.financeiroService.contasAReceber({ vendedorId, clienteId, formaPagamento, situacao, dataInicio, dataFim });
  }

  @Post('marcar-pago/:pedidoId')
  marcarPago(@Param('pedidoId') pedidoId: string, @Request() req: any) {
    return this.financeiroService.marcarPago(pedidoId, req.user.id);
  }
}
