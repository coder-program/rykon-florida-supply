-- Boleto deixa de existir como opção: passa a ser Faturado
UPDATE "pedidos" SET "formaPagamento" = 'FATURADO' WHERE "formaPagamento" = 'BOLETO';
UPDATE "pagamentos_pedido" SET "formaPagamento" = 'FATURADO' WHERE "formaPagamento" = 'BOLETO';

-- Forma habitual do cliente era texto livre do select (PIX, Boleto, Dinheiro, Outros)
UPDATE "clientes" SET "formaPagamentoUsual" = 'FATURADO' WHERE UPPER("formaPagamentoUsual") = 'BOLETO';
UPDATE "clientes" SET "formaPagamentoUsual" = 'DINHEIRO' WHERE "formaPagamentoUsual" = 'Dinheiro';
UPDATE "clientes" SET "formaPagamentoUsual" = 'OUTROS' WHERE "formaPagamentoUsual" = 'Outros';
