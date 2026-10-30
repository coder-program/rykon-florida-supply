ALTER TABLE "pedidos" ADD COLUMN "dataPrevistaEntrega" TIMESTAMP(3);
ALTER TABLE "pedidos" ADD COLUMN "problemaEntrega" TEXT;
ALTER TABLE "pedidos" ADD COLUMN "problemaEntregaEm" TIMESTAMP(3);
