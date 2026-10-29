-- Avisos de cobrança ainda não enviados passam para o texto novo: sem "a prazo" e com o fecho
UPDATE "notificacoes_cliente"
SET "titulo" = 'Compra registrada'
WHERE "status" = 'PENDENTE' AND "titulo" = 'Compra a prazo registrada';

UPDATE "notificacoes_cliente"
SET "mensagem" = REPLACE("mensagem", 'Sua compra a prazo do', 'Sua compra do')
WHERE "status" = 'PENDENTE' AND "tipo" = 'COMPRA_A_PRAZO';

UPDATE "notificacoes_cliente"
SET "mensagem" = "mensagem" || E'\n\nQualquer coisa ficamos à disposição,\nFlorida Supply Hortifruti ;)'
WHERE "status" = 'PENDENTE'
  AND "tipo" IN ('COMPRA_A_PRAZO', 'VENCE_EM_3_DIAS', 'VENCIMENTO_HOJE')
  AND "mensagem" NOT LIKE '%Florida Supply Hortifruti%';
