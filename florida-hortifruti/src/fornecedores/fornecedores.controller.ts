import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { FornecedoresService } from './fornecedores.service';
import { CreateFornecedorDto, UpdateFornecedorDto } from './dto/fornecedor.dto';

// Quem registra entrada de lote: administrador, administrativo/financeiro e supervisor
@Controller('fornecedores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO, PapelUsuario.SUPERVISOR)
export class FornecedoresController {
  constructor(private fornecedoresService: FornecedoresService) {}

  @Get()
  findAll(@Query('incluirInativos') incluirInativos?: string) {
    return this.fornecedoresService.findAll(incluirInativos === 'true');
  }

  @Post()
  create(@Body() dto: CreateFornecedorDto) {
    return this.fornecedoresService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFornecedorDto) {
    return this.fornecedoresService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fornecedoresService.remove(id);
  }

  @Post(':id/reativar')
  reativar(@Param('id') id: string) {
    return this.fornecedoresService.reativar(id);
  }
}
