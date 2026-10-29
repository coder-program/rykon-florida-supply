import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { InvestimentosService } from './investimentos.service';
import { RegistrarDevolucaoInvestimentoDto, SalvarInvestimentoDto } from './dto/investimento.dto';

// Aportes dos sócios: só administrador e administrativo/financeiro (supervisor não vê)
@Controller('investimentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
export class InvestimentosController {
  constructor(private service: InvestimentosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Post()
  criar(@Body() dto: SalvarInvestimentoDto, @Request() req: any) {
    return this.service.criar(dto, req.user.id);
  }

  @Put(':id')
  atualizar(@Param('id') id: string, @Body() dto: SalvarInvestimentoDto) {
    return this.service.atualizar(id, dto);
  }

  @Delete(':id')
  remover(@Param('id') id: string) {
    return this.service.remover(id);
  }

  @Post(':id/devolucoes')
  registrarDevolucao(
    @Param('id') id: string,
    @Body() dto: RegistrarDevolucaoInvestimentoDto,
    @Request() req: any,
  ) {
    return this.service.registrarDevolucao(id, dto, req.user.id);
  }

  @Delete(':id/devolucoes/:devolucaoId')
  removerDevolucao(@Param('id') id: string, @Param('devolucaoId') devolucaoId: string) {
    return this.service.removerDevolucao(id, devolucaoId);
  }
}
