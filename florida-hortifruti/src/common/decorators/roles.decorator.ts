import { SetMetadata } from '@nestjs/common';
import { PapelUsuario } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Uso: @Roles(PapelUsuario.ADMINISTRADOR, PapelUsuario.ADMINISTRATIVO)
export const Roles = (...papeis: PapelUsuario[]) => SetMetadata(ROLES_KEY, papeis);
