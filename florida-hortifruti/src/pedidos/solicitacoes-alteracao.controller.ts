import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PedidosService } from './pedidos.service';
import { FiltrosSolicitacaoDto, NegarSolicitacaoDto } from './dto/pedido.dto';

@Controller('solicitacoes-alteracao')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SolicitacoesAlteracaoController {
  constructor(private pedidosService: PedidosService) {}

  @Get()
  listar(@Query() filtros: FiltrosSolicitacaoDto, @Request() req: any) {
    return this.pedidosService.listarSolicitacoes(filtros, req.user.id, req.user.papel);
  }

  @Post(':id/aprovar')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  aprovar(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.aprovarSolicitacao(id, req.user.id);
  }

  @Post(':id/negar')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  negar(@Param('id') id: string, @Body() dto: NegarSolicitacaoDto, @Request() req: any) {
    return this.pedidosService.negarSolicitacao(id, req.user.id, dto.resposta);
  }
}
