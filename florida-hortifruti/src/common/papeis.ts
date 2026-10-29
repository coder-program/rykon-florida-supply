import { PapelUsuario } from '@prisma/client';

// Vendedor e revendedor só enxergam e mexem no que é deles (pedidos, solicitações)
export function vendeSoOSeu(papel?: PapelUsuario) {
  return papel === PapelUsuario.VENDEDOR || papel === PapelUsuario.REVENDEDOR;
}
