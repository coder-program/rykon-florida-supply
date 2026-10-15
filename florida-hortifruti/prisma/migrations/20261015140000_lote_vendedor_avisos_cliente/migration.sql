-- DropIndex
DROP INDEX "lotes_produto_produtoId_numero_key";

-- CreateIndex
CREATE INDEX "lotes_produto_produtoId_numero_idx" ON "lotes_produto"("produtoId", "numero");

-- AlterTable
ALTER TABLE "itens_pedido" ADD COLUMN "loteId" TEXT;

-- AlterTable
ALTER TABLE "notificacoes_cliente" ADD COLUMN "lidaEm" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
