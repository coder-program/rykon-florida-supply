import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RelatoriosService } from './relatorios.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
export class RelatoriosController {
  constructor(private relatoriosService: RelatoriosService) {}

  // Seção 20: dashboard com período selecionável
  @Get('dashboard')
  dashboard(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.relatoriosService.dashboard(dataInicio, dataFim);
  }

  // Seção 21: relatórios de vendas
  @Get('relatorios/vendas')
  vendasPorPeriodo(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.relatoriosService.vendasPorPeriodo(dataInicio, dataFim);
  }

  @Get('relatorios/vendas/por-vendedor')
  vendasPorVendedor(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.relatoriosService.vendasPorVendedor(dataInicio, dataFim);
  }

  @Get('relatorios/vendas/por-produto')
  vendasPorProduto(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.relatoriosService.vendasPorProduto(dataInicio, dataFim);
  }

  @Get('relatorios/financeiro')
  financeiro(@Query('dataInicio') dataInicio?: string, @Query('dataFim') dataFim?: string) {
    return this.relatoriosService.financeiro(dataInicio, dataFim);
  }

  @Get('relatorios/estoque')
  estoqueAtual() {
    return this.relatoriosService.estoqueAtual();
  }

  // Seção 21: exportação CSV
  @Get('relatorios/vendas/csv')
  async exportarVendasCsv(
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
    @Res() res: Response,
  ) {
    const csv = await this.relatoriosService.gerarCsvVendas(dataInicio, dataFim);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vendas.csv"');
    res.send('\uFEFF' + csv); // BOM para Excel reconhecer UTF-8
  }

  @Get('relatorios/estoque/csv')
  async exportarEstoqueCsv(@Res() res: Response) {
    const csv = await this.relatoriosService.gerarCsvEstoque();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="estoque.csv"');
    res.send('\uFEFF' + csv);
  }
}
