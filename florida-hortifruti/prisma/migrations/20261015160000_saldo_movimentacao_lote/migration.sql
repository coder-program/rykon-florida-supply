-- AlterTable
ALTER TABLE "movimentacoes_estoque_lote" ADD COLUMN "saldoAntes" DECIMAL(10,2),
ADD COLUMN "saldoDepois" DECIMAL(10,2);

-- Backfill: recalcula o saldo do lote em cada movimento já registrado, em ordem cronológica.
-- Entradas (compra/ajuste positivo/devolução) somam; saídas (vendas) subtraem.
UPDATE "movimentacoes_estoque_lote" AS mel
SET "saldoDepois" = x.saldo,
    "saldoAntes" = x.saldo - x.delta
FROM (
  SELECT m.id,
         CASE WHEN me.tipo = 'SAIDA' OR me.quantidade < 0 THEN -m.quantidade ELSE m.quantidade END AS delta,
         SUM(CASE WHEN me.tipo = 'SAIDA' OR me.quantidade < 0 THEN -m.quantidade ELSE m.quantidade END)
           OVER (PARTITION BY m."loteId" ORDER BY m.data, m.id) AS saldo
  FROM "movimentacoes_estoque_lote" m
  JOIN "movimentacoes_estoque" me ON me.id = m."movimentacaoId"
) AS x
WHERE x.id = mel.id;
