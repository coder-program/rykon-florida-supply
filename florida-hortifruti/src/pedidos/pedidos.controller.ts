import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PapelUsuario, StatusPedido } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PedidosService } from './pedidos.service';
import {
  CreatePedidoDto,
  UpdatePedidoDto,
  FiltrosPedidoDto,
  CriarSolicitacaoAlteracaoDto,
  MarcarEntregueDto,
  RejeitarPedidoDto,
  AtribuirPedidoDto,
  AtualizarItensPedidoDto,
} from './dto/pedido.dto';

const EQUIPE = [PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR] as const;
const EQUIPE_VENDEDOR = [
  PapelUsuario.ADMINISTRATIVO,
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.VENDEDOR,
] as const;

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...EQUIPE_VENDEDOR)
export class PedidosController {
  constructor(private pedidosService: PedidosService) {}

  @Post()
  create(@Body() dto: CreatePedidoDto, @Request() req: any) {
    return this.pedidosService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Query() filtros: FiltrosPedidoDto, @Request() req: any) {
    return this.pedidosService.findAll(filtros, req.user.id, req.user.papel);
  }

  @Get(':id/solicitacoes-alteracao')
  listarSolicitacoes(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.listarSolicitacoesDoPedido(id, req.user.id, req.user.papel);
  }

  @Post(':id/solicitacoes-alteracao')
  solicitarAlteracao(
    @Param('id') id: string,
    @Body() dto: CriarSolicitacaoAlteracaoDto,
    @Request() req: any,
  ) {
    return this.pedidosService.solicitarAlteracao(id, dto, req.user.id, req.user.papel);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.findOne(id, req.user.id, req.user.papel);
  }

  @Patch(':id')
  @Roles(...EQUIPE)
  atualizar(@Param('id') id: string, @Body() dto: UpdatePedidoDto, @Request() req: any) {
    return this.pedidosService.atualizar(id, dto, req.user.id, req.user.papel);
  }

  @Put(':id/itens')
  @Roles(...EQUIPE)
  atualizarItens(
    @Param('id') id: string,
    @Body() dto: AtualizarItensPedidoDto,
    @Request() req: any,
  ) {
    return this.pedidosService.atualizarItensAntesAprovacao(id, dto.itens, req.user.id);
  }

  @Post(':id/aprovar')
  @Roles(...EQUIPE)
  aprovar(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.aprovar(id, req.user.id);
  }

  @Post(':id/rejeitar')
  @Roles(...EQUIPE)
  rejeitar(@Param('id') id: string, @Body() dto: RejeitarPedidoDto, @Request() req: any) {
    return this.pedidosService.rejeitar(id, req.user.id, dto);
  }

  @Post(':id/separacao')
  @Roles(...EQUIPE)
  separacao(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.atualizarStatus(id, StatusPedido.EM_SEPARACAO, req.user.id);
  }

  @Post(':id/pronto-para-entrega')
  @Roles(...EQUIPE)
  pronto(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.atualizarStatus(id, StatusPedido.PRONTO_PARA_ENTREGA, req.user.id);
  }

  @Post(':id/em-entrega')
  @Roles(...EQUIPE)
  emEntrega(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.atualizarStatus(id, StatusPedido.EM_ENTREGA, req.user.id);
  }

  @Post(':id/atribuir')
  @Roles(...EQUIPE)
  atribuir(@Param('id') id: string, @Body() dto: AtribuirPedidoDto, @Request() req: any) {
    return this.pedidosService.atribuir(id, dto, req.user.id);
  }

  @Post(':id/atribuir-entregador')
  @Roles(...EQUIPE)
  atribuirEntregador(@Param('id') id: string, @Body() dto: AtribuirPedidoDto, @Request() req: any) {
    return this.pedidosService.atribuir(id, { entregadorId: dto.entregadorId }, req.user.id);
  }

  @Post(':id/entregue')
  @Roles(...EQUIPE_VENDEDOR)
  entregue(@Param('id') id: string, @Body() dto: MarcarEntregueDto, @Request() req: any) {
    return this.pedidosService.marcarEntregue(id, req.user.id, req.user.papel, dto);
  }

  @Post(':id/cancelar')
  @Roles(...EQUIPE)
  cancelar(@Param('id') id: string, @Request() req: any) {
    return this.pedidosService.cancelar(id, req.user.id);
  }
}
