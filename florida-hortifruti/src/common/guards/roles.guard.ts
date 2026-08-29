import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PapelUsuario } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Regra do escopo: vendedor não acessa estoque/financeiro; administrativo tem
// acesso amplo mas não a configurações; administrador tem acesso total.
// Este guard roda DEPOIS do JwtAuthGuard, que já populou request.user.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeisPermitidos = this.reflector.getAllAndOverride<PapelUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!papeisPermitidos || papeisPermitidos.length === 0) {
      return true; // rota sem restrição de papel
    }

    const { user } = context.switchToHttp().getRequest();
    return papeisPermitidos.includes(user?.papel);
  }
}
