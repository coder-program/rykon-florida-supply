import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PapelUsuario } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const autenticado = (await super.canActivate(context)) as boolean;
    if (!autenticado) return false;

    // Visão geral (TV do salão) é só leitura: acessa apenas as rotas que liberam
    // o papel explicitamente no @Roles — rota sem @Roles também fica bloqueada.
    const { user } = context.switchToHttp().getRequest();
    if (user?.papel === PapelUsuario.VISAO_GERAL) {
      const papeisPermitidos = this.reflector.getAllAndOverride<PapelUsuario[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!papeisPermitidos?.includes(PapelUsuario.VISAO_GERAL)) {
        throw new ForbiddenException('Perfil Visão geral só acessa o dashboard e as metas');
      }
    }

    return true;
  }
}
