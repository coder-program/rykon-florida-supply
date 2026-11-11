-- CreateTable
CREATE TABLE "contatos_cliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "proximoContato" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contatos_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contatos_cliente_clienteId_data_idx" ON "contatos_cliente"("clienteId", "data");

-- AddForeignKey
ALTER TABLE "contatos_cliente" ADD CONSTRAINT "contatos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_cliente" ADD CONSTRAINT "contatos_cliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
