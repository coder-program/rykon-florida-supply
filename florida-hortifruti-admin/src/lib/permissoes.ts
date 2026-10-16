// Supervisor = vendedor que também faz as compras. No painel ele vê só estas telas;
// a API aplica a mesma regra (@Roles com PapelUsuario.SUPERVISOR).
export const ROTAS_SUPERVISOR = [
  '/',
  '/metas',
  '/pedidos',
  '/solicitacoes',
  '/devolucoes',
  '/estoque',
  '/lotes',
]
