import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProdutosService } from './produtos.service';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/produto.dto';

@Controller('produtos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProdutosController {
  constructor(private produtosService: ProdutosService) {}

  @Post()
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  create(@Body() dto: CreateProdutoDto) {
    return this.produtosService.create(dto);
  }

  @Get()
  findAll(@Query('incluirInativos') incluirInativos?: string) {
    return this.produtosService.findAll(incluirInativos === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.produtosService.findOne(id);
  }

  @Put(':id')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  update(@Param('id') id: string, @Body() dto: UpdateProdutoDto, @Request() req: any) {
    return this.produtosService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  remove(@Param('id') id: string) {
    return this.produtosService.remove(id);
  }

  @Post(':id/reativar')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  reativar(@Param('id') id: string) {
    return this.produtosService.reativar(id);
  }

  // Item 7 do escopo: histórico de alterações de preço
  @Get(':id/historico-precos')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  historicoPrecos(@Param('id') id: string) {
    return this.produtosService.historicoPrecos(id);
  }
}
