import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProdutosService } from './produtos.service';
import {
  CreateProdutoDto,
  UpdateProdutoDto,
  CreateCategoriaDto,
  UpdateCategoriaDto,
} from './dto/produto.dto';

// Revendedor não vê o custo da Flórida
function semCusto<T extends object>(produto: T) {
  return { ...produto, custo: undefined };
}

@Controller('produtos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  PapelUsuario.VENDEDOR,
  PapelUsuario.SUPERVISOR,
  PapelUsuario.ADMINISTRATIVO,
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.REVENDEDOR,
)
export class ProdutosController {
  constructor(private produtosService: ProdutosService) {}

  @Post()
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  create(@Body() dto: CreateProdutoDto) {
    return this.produtosService.create(dto);
  }

  @Get()
  async findAll(@Request() req: any, @Query('incluirInativos') incluirInativos?: string) {
    const lista = await this.produtosService.findAll(incluirInativos === 'true');
    return req.user.papel === PapelUsuario.REVENDEDOR ? lista.map(semCusto) : lista;
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const produto = await this.produtosService.findOne(id);
    return req.user.papel === PapelUsuario.REVENDEDOR ? semCusto(produto) : produto;
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

  @Get(':id/historico-precos')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  historicoPrecos(@Param('id') id: string) {
    return this.produtosService.historicoPrecos(id);
  }
}

@Controller('categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  PapelUsuario.VENDEDOR,
  PapelUsuario.SUPERVISOR,
  PapelUsuario.ADMINISTRATIVO,
  PapelUsuario.ADMINISTRADOR,
)
export class CategoriasController {
  constructor(private produtosService: ProdutosService) {}

  @Get()
  listar() {
    return this.produtosService.listarCategorias();
  }

  @Post()
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  criar(@Body() dto: CreateCategoriaDto) {
    return this.produtosService.criarCategoria(dto.nome);
  }

  @Put(':id')
  @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
  atualizar(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    return this.produtosService.atualizarCategoria(id, dto.nome);
  }
}
