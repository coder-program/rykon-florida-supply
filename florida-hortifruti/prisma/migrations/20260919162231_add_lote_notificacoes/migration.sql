-- DropForeignKey
ALTER TABLE "comprovantes_entrega" DROP CONSTRAINT "comprovantes_entrega_pedidoId_fkey";

-- DropForeignKey
ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_vendedorId_fkey";

-- DropForeignKey
ALTER TABLE "precos_cliente" DROP CONSTRAINT "precos_cliente_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "precos_cliente" DROP CONSTRAINT "precos_cliente_produtoId_fkey";

-- CreateTable
CREATE TABLE "itens_pedido_lote" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "itens_pedido_lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_produto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantidadeInicial" DECIMAL(10,2) NOT NULL,
    "quantidadeDisponivel" DECIMAL(10,2) NOT NULL,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque_lote" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "origem" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes_cliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "agendadaPara" TIMESTAMP(3),
    "enviadaEm" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itens_pedido_lote_pedidoId_produtoId_idx" ON "itens_pedido_lote"("pedidoId", "produtoId");

-- CreateIndex
CREATE INDEX "lotes_produto_produtoId_ativo_dataEntrada_idx" ON "lotes_produto"("produtoId", "ativo", "dataEntrada");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_produto_produtoId_numero_key" ON "lotes_produto"("produtoId", "numero");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_lote_loteId_data_idx" ON "movimentacoes_estoque_lote"("loteId", "data");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_lote_movimentacaoId_idx" ON "movimentacoes_estoque_lote"("movimentacaoId");

-- CreateIndex
CREATE INDEX "notificacoes_cliente_clienteId_status_agendadaPara_idx" ON "notificacoes_cliente"("clienteId", "status", "agendadaPara");

-- AddForeignKey
ALTER TABLE "precos_cliente" ADD CONSTRAINT "precos_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precos_cliente" ADD CONSTRAINT "precos_cliente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido_lote" ADD CONSTRAINT "itens_pedido_lote_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido_lote" ADD CONSTRAINT "itens_pedido_lote_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido_lote" ADD CONSTRAINT "itens_pedido_lote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprovantes_entrega" ADD CONSTRAINT "comprovantes_entrega_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_produto" ADD CONSTRAINT "lotes_produto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque_lote" ADD CONSTRAINT "movimentacoes_estoque_lote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque_lote" ADD CONSTRAINT "movimentacoes_estoque_lote_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "movimentacoes_estoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes_cliente" ADD CONSTRAINT "notificacoes_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes_cliente" ADD CONSTRAINT "notificacoes_cliente_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
