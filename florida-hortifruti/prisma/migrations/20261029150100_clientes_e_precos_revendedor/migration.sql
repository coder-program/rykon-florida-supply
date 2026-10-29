-- Clientes do revendedor ficam separados dos da Flórida
ALTER TABLE "clientes" ADD COLUMN "revendedorId" TEXT;
CREATE INDEX "clientes_revendedorId_idx" ON "clientes"("revendedorId");
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_revendedorId_fkey" FOREIGN KEY ("revendedorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preço de revenda (do revendedor para o cliente dele), por produto
ALTER TABLE "pedidos" ADD COLUMN "precosRevenda" JSONB;
