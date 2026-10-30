import { PapelUsuario } from '@prisma/client';

// Vendedor e revendedor só enxergam e mexem no que é deles (pedidos, solicitações)
export function vendeSoOSeu(papel?: PapelUsuario) {
  return papel === PapelUsuario.VENDEDOR || papel === PapelUsuario.REVENDEDOR;
}

type EnderecoComCidade = { cidade?: { nome?: string } | null };

// Revendedor usa os clientes da Flórida nos pedidos, mas só vê o nome e a cidade deles
export function clienteParaRevendedor<
  T extends { revendedorId: string | null; enderecos?: EnderecoComCidade[] },
>(cliente: T, revendedorId: string | null) {
  if (cliente.revendedorId === revendedorId) return cliente;
  return {
    ...cliente,
    cidade: cliente.enderecos?.[0]?.cidade?.nome ?? null,
    enderecos: [],
    cnpjCpf: undefined,
    telefone: undefined,
    whatsapp: undefined,
    email: undefined,
    responsavelContato: undefined,
    observacoes: undefined,
    condicaoPagamento: undefined,
    formaPagamentoUsual: undefined,
    usuarioId: undefined,
    statusConvite: undefined,
    tokenConvite: undefined,
    tokenConviteExpiraEm: undefined,
  };
}
