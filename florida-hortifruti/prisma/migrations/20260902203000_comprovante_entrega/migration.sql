-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "entregueEm" TIMESTAMP(3),
ADD COLUMN "recebidoPor" TEXT,
ADD COLUMN "observacaoEntrega" TEXT,
ADD COLUMN "fotoEntrega" TEXT;
