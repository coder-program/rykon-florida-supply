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
import { ClientesService } from './clientes.service';
import { ProdutosService } from '../produtos/produtos.service';
import { AtivarAcessoDto, CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import { UpsertPrecoClienteDto } from '../produtos/dto/produto.dto';

@Controller('clientes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUsuario.VENDEDOR, PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
export class ClientesController {
  constructor(
    private clientesService: ClientesService,
    private produtosService: ProdutosService,
  ) {}

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  findAll(@Query('busca') busca?: string, @Query('incluirInativos') incluirInativos?: string) {
    if (busca) return this.clientesService.search(busca);
    return this.clientesService.findAll(incluirInativos === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  @Post(':id/reativar')
  reativar(@Param('id') id: string) {
    return this.clientesService.reativar(id);
  }

  @Post(':id/ativar-acesso')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  ativarAcesso(@Param('id') id: string, @Body() dto: AtivarAcessoDto) {
    return this.clientesService.ativarAcesso(id, dto.email);
  }

  @Get(':id/precos')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  listarPrecos(@Param('id') id: string) {
    return this.produtosService.listarPrecosCliente(id);
  }

  @Put(':id/precos')
  @Roles(PapelUsuario.ADMINISTRATIVO, PapelUsuario.ADMINISTRADOR)
  definirPreco(@Param('id') id: string, @Body() dto: UpsertPrecoClienteDto, @Request() req: any) {
    return this.produtosService.definirPrecoCliente(
      id,
      dto.produtoId,
      dto.precoUnitario,
      req.user.id,
    );
  }
}
