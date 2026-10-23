import { PapelUsuario } from '@prisma/client';

// Cada app só aceita login dos perfis dele: motorista, vendedor, cliente etc. nunca entram
// pelo app de outro perfil. Manter igual à lista PAPEIS_DO_APP de cada frontend.
export const PAPEIS_POR_APP = {
  admin: [
    PapelUsuario.ADMINISTRADOR,
    PapelUsuario.ADMINISTRATIVO,
    PapelUsuario.SUPERVISOR,
    PapelUsuario.VISAO_GERAL,
  ],
  vendedor: [PapelUsuario.VENDEDOR, PapelUsuario.SUPERVISOR],
  // Supervisor às vezes faz entregas
  motorista: [PapelUsuario.MOTORISTA, PapelUsuario.SUPERVISOR],
  cliente: [PapelUsuario.CLIENTE],
} satisfies Record<string, PapelUsuario[]>;

export type AppAcesso = keyof typeof PAPEIS_POR_APP;

export const APPS_ACESSO = Object.keys(PAPEIS_POR_APP) as AppAcesso[];

const NOME_APP: Record<AppAcesso, string> = {
  admin: 'Painel administrativo',
  vendedor: 'app do Vendedor',
  motorista: 'app do Motorista',
  cliente: 'app do Cliente',
};

export function papelPodeEntrar(app: AppAcesso, papel: PapelUsuario) {
  return (PAPEIS_POR_APP[app] as PapelUsuario[]).includes(papel);
}

/** Mensagem para quem tentou entrar pelo app errado, apontando o app certo */
export function mensagemAppErrado(papel: PapelUsuario) {
  const certo = APPS_ACESSO.find((app) => papelPodeEntrar(app, papel));
  return certo
    ? `Este usuário não tem acesso a este app. Entre pelo ${NOME_APP[certo]}.`
    : 'Este usuário não tem acesso a este app.';
}
