import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEnderecoDto, UpdateEnderecoDto } from './dto/enderecos.dto';
import { EnderecosService } from './enderecos.service';

@Controller('enderecos')
@UseGuards(JwtAuthGuard)
export class EnderecosController {
  constructor(private readonly enderecosService: EnderecosService) {}

  @Post(':entidadeTipo/:entidadeId')
  create(
    @Param('entidadeTipo') entidadeTipo: string,
    @Param('entidadeId') entidadeId: string,
    @Body() dto: CreateEnderecoDto,
  ) {
    return this.enderecosService.create(entidadeTipo, entidadeId, dto);
  }

  @Get(':entidadeTipo/:entidadeId')
  findByEntidade(
    @Param('entidadeTipo') entidadeTipo: string,
    @Param('entidadeId') entidadeId: string,
  ) {
    return this.enderecosService.findByEntidade(entidadeTipo, entidadeId);
  }

  @Get(':entidadeTipo/:entidadeId/principal')
  findPrincipal(
    @Param('entidadeTipo') entidadeTipo: string,
    @Param('entidadeId') entidadeId: string,
  ) {
    return this.enderecosService.findPrincipal(entidadeTipo, entidadeId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEnderecoDto) {
    return this.enderecosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.enderecosService.remove(id);
  }
}
