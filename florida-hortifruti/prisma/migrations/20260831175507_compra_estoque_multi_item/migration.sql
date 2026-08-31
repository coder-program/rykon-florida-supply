-- CreateTable
CREATE TABLE "compras_estoque" (
    "id" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "valorFrete" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorComissao" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "compras_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_compra_estoque" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "valorProdutoInformado" DECIMAL(10,2) NOT NULL,
    "rateioFrete" DECIMAL(10,2) NOT NULL,
    "rateioComissao" DECIMAL(10,2) NOT NULL,
    "custoUnitarioFinal" DECIMAL(12,4) NOT NULL,
    "movimentacaoId" TEXT,

    CONSTRAINT "itens_compra_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "itens_compra_estoque_movimentacaoId_key" ON "itens_compra_estoque"("movimentacaoId");

-- AddForeignKey
ALTER TABLE "compras_estoque" ADD CONSTRAINT "compras_estoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_compra_estoque" ADD CONSTRAINT "itens_compra_estoque_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras_estoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_compra_estoque" ADD CONSTRAINT "itens_compra_estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_compra_estoque" ADD CONSTRAINT "itens_compra_estoque_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "movimentacoes_estoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
