-- Perdas registradas no reembolso das devoluções
CREATE TABLE "perdas_devolucao" (
    "id" TEXT NOT NULL,
    "devolucaoId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "data" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perdas_devolucao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "perdas_devolucao_data_idx" ON "perdas_devolucao"("data");

ALTER TABLE "perdas_devolucao" ADD CONSTRAINT "perdas_devolucao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "perdas_devolucao" ADD CONSTRAINT "perdas_devolucao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
