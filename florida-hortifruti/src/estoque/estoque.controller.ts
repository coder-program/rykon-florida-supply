import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EstoqueService } from './estoque.service';
import { EntradaEstoqueDto, AjusteEstoqueDto } from './dto/estoque.dto';

@Controller('estoque')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR) // regra 4 do escopo
export class EstoqueController {
  constructor(private estoqueService: EstoqueService) {}

  @Post('entrada')
  registrarEntrada(@Body() dto: EntradaEstoqueDto, @Request() req: any) {
    return this.estoqueService.registrarEntrada({
      fornecedor: dto.fornecedor,
      valorFrete: dto.valorFrete,
      valorComissao: dto.valorComissao,
      observacao: dto.observacao,
      itens: dto.itens,
      usuarioId: req.user.id,
    });
  }

  @Post('ajuste')
  registrarAjuste(@Body() dto: AjusteEstoqueDto, @Request() req: any) {
    return this.estoqueService.registrarAjuste({ ...dto, usuarioId: req.user.id });
  }

  @Get('saldos')
  saldosTodos() {
    return this.estoqueService.saldosTodos();
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
