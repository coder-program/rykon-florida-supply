-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "caixasEtiquetadas" INTEGER NOT NULL DEFAULT 0;

UPDATE "pedidos"
SET "caixasEtiquetadas" = COALESCE((
  SELECT SUM(ROUND(i."quantidade"))::int
  FROM "itens_pedido" i
  WHERE i."pedidoId" = "pedidos"."id"
), 0)
WHERE "status" IN ('APROVADO', 'SEPARACAO_ENTREGA', 'ENTREGUE', 'FATURADO', 'PAGO');

-- CreateEnum
CREATE TYPE "StatusSolicitacaoAlteracao" AS ENUM ('PENDENTE', 'APROVADA', 'NEGADA');

-- CreateTable
CREATE TABLE "solicitacoes_alteracao_pedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "status" "StatusSolicitacaoAlteracao" NOT NULL DEFAULT 'PENDENTE',
    "itens" JSONB NOT NULL,
    "observacao" TEXT,
    "resposta" TEXT,
    "respondidoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "solicitacoes_alteracao_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitacoes_alteracao_pedido_pedidoId_status_idx" ON "solicitacoes_alteracao_pedido"("pedidoId", "status");

-- CreateIndex
CREATE INDEX "solicitacoes_alteracao_pedido_status_criadoEm_idx" ON "solicitacoes_alteracao_pedido"("status", "criadoEm");

-- AddForeignKey
ALTER TABLE "solicitacoes_alteracao_pedido" ADD CONSTRAINT "solicitacoes_alteracao_pedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_alteracao_pedido" ADD CONSTRAINT "solicitacoes_alteracao_pedido_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_alteracao_pedido" ADD CONSTRAINT "solicitacoes_alteracao_pedido_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
