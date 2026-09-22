-- AlterTable
ALTER TABLE "etiquetas" ADD COLUMN "dataEmbalagem" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "historico_status_pedido" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "status" "StatusPedido" NOT NULL,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_status_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historico_status_pedido_pedidoId_alteradoEm_idx" ON "historico_status_pedido"("pedidoId", "alteradoEm");

-- AddForeignKey
ALTER TABLE "historico_status_pedido" ADD CONSTRAINT "historico_status_pedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
