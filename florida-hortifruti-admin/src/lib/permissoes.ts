// Supervisor = vendedor que também faz as compras. No painel ele vê só estas telas;
// a API aplica a mesma regra (@Roles com PapelUsuario.SUPERVISOR).
export const ROTAS_SUPERVISOR = [
  '/',
  '/metas',
  '/pedidos',
  '/clientes',
  '/solicitacoes',
  '/devolucoes',
  '/estoque',
  '/lotes',
  '/fornecedores',
  '/financeiro',
]

// Visão geral = TV do salão: só Dashboard e Metas, sem nenhuma ação de cadastro
export const ROTAS_VISAO_GERAL = ['/', '/metas']

// Telas liberadas para o papel; null = sem restrição de tela (admin/administrativo)
export function rotasPermitidas(papel: string | undefined): string[] | null {
  if (papel === 'SUPERVISOR') return ROTAS_SUPERVISOR
  if (papel === 'VISAO_GERAL') return ROTAS_VISAO_GERAL
  return null
}
