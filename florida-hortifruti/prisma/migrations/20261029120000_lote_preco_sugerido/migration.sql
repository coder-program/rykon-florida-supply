-- Preço sugerido (mínimo) de venda por caixa, informado na entrada do lote
ALTER TABLE "lotes_produto" ADD COLUMN "precoSugeridoVenda" DECIMAL(10,2);
