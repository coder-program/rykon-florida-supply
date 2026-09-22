import { StatusPedido } from '@prisma/client';

type ClientComHistorico = {
  historicoStatusPedido: {
    create: (args: { data: { pedidoId: string; status: StatusPedido } }) => Promise<unknown>;
  };
};

// Registra uma entrada na timeline de status do pedido (usada no acompanhamento de rota do cliente)
export function registrarHistoricoStatus(
  prisma: ClientComHistorico,
  pedidoId: string,
  status: StatusPedido,
) {
  return prisma.historicoStatusPedido.create({ data: { pedidoId, status } });
}
