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

  @Get('dashboard')
  dashboard(@Query() query: Record<string, string | undefined>) {
    return this.relatoriosService.dashboard(query ?? {});
  }

  @Get('relatorios/vendas')
  vendasPorPeriodo(@Query() query: Record<string, string | undefined>) {
    return this.relatoriosService.vendasPorPeriodo(query ?? {});
  }

  @Get('relatorios/vendas/por-vendedor')
  vendasPorVendedor(@Query() query: Record<string, string | undefined>) {
    return this.relatoriosService.vendasPorVendedor(query ?? {});
  }

  @Get('relatorios/vendas/por-produto')
  vendasPorProduto(@Query() query: Record<string, string | undefined>) {
    return this.relatoriosService.vendasPorProduto(query ?? {});
  }

  @Get('relatorios/financeiro')
  financeiro(@Query() query: Record<string, string | undefined>) {
    return this.relatoriosService.financeiro(query ?? {});
  }

  @Get('relatorios/estoque')
  estoqueAtual(@Query() query: Record<string, string | undefined>) {
    return this.relatoriosService.estoqueAtual(query ?? {});
  }

  @Get('relatorios/vendas/csv')
  async exportarVendasCsv(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const csv = await this.relatoriosService.gerarCsvVendas(query ?? {});
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vendas.csv"');
    res.send('\uFEFF' + csv);
  }

  @Get('relatorios/vendas/json')
  async exportarVendasJson(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const json = await this.relatoriosService.gerarJsonVendas(query ?? {});
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vendas.json"');
    res.send(json);
  }

  @Get('relatorios/vendas/xml')
  async exportarVendasXml(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const xml = await this.relatoriosService.gerarXmlVendas(query ?? {});
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="vendas.xml"');
    res.send(xml);
  }

  @Get('relatorios/estoque/csv')
  async exportarEstoqueCsv(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const csv = await this.relatoriosService.gerarCsvEstoque(query ?? {});
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="estoque.csv"');
    res.send('\uFEFF' + csv);
  }

  @Get('relatorios/estoque/json')
  async exportarEstoqueJson(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const json = await this.relatoriosService.gerarJsonEstoque(query ?? {});
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="estoque.json"');
    res.send(json);
  }

  @Get('relatorios/estoque/xml')
  async exportarEstoqueXml(@Query() query: Record<string, string | undefined>, @Res() res: Response) {
    const xml = await this.relatoriosService.gerarXmlEstoque(query ?? {});
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="estoque.xml"');
    res.send(xml);
  }
}
