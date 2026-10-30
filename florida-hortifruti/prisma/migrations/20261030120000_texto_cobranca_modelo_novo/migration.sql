-- Avisos de cobrança ainda não enviados passam para o modelo novo (o valor continua o do aviso)
UPDATE "notificacoes_cliente" n
SET "mensagem" = 'Olá, ' || c."razaoSocialOuNome" || E'! 🍓\nPassando para lembrar que temos um valor em aberto referente à compra do dia '
  || to_char(p."data" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
  || ', no valor de ' || substring(n."mensagem" from 'R\$[^0-9]*[0-9.,]*[0-9]')
  || E'.\n\nSe já realizaram o pagamento, podem nos enviar o comprovante, por gentileza?\nChave Pix: 11 91205-0672\n\nQualquer coisa, ficamos à disposição! ❤️\nFlórida Supply Hortifruti Ltda 🍓'
FROM "pedidos" p
JOIN "clientes" c ON c."id" = p."clienteId"
WHERE n."pedidoId" = p."id"
  AND n."status" = 'PENDENTE'
  AND n."tipo" IN ('COMPRA_A_PRAZO', 'VENCE_EM_3_DIAS', 'VENCIMENTO_HOJE')
  AND n."mensagem" ~ 'R\$[^0-9]*[0-9]';
