-- Novas formas de pagamento. Em migração separada da que usa os valores:
-- o Postgres não deixa usar um valor de enum na mesma transação em que ele foi criado
ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'FATURADO';
ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'LINK_PAGAMENTO';
ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'CARTAO_CREDITO';
ALTER TYPE "FormaPagamento" ADD VALUE IF NOT EXISTS 'CARTAO_DEBITO';
