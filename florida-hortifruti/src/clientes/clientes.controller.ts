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
@Roles(
  PapelUsuario.VENDEDOR,
  PapelUsuario.SUPERVISOR,
  PapelUsuario.ADMINISTRATIVO,
  PapelUsuario.ADMINISTRADOR,
  PapelUsuario.REVENDEDOR,
)
export class ClientesController {
  constructor(
    private clientesService: ClientesService,
    private produtosService: ProdutosService,
  ) {}

  @Post()
  create(@Body() dto: CreateClienteDto, @Request() req: any) {
    return this.clientesService.create(dto, req.user);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('busca') busca?: string,
    @Query('incluirInativos') incluirInativos?: string,
  ) {
    if (busca) return this.clientesService.search(busca, req.user);
    return this.clientesService.findAll(incluirInativos === 'true', req.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    await this.clientesService.garantirAcesso(id, req.user);
    return this.clientesService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClienteDto, @Request() req: any) {
    await this.clientesService.garantirAcesso(id, req.user);
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.clientesService.garantirAcesso(id, req.user);
    return this.clientesService.remove(id);
  }

  @Post(':id/reativar')
  async reativar(@Param('id') id: string, @Request() req: any) {
    await this.clientesService.garantirAcesso(id, req.user);
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
