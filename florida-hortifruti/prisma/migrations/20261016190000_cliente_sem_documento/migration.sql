-- Clientes cadastrados com CPF/CNPJ vazio recebem placeholder único,
-- liberando o cadastro de outros clientes sem documento.
UPDATE "clientes"
SET "cnpjCpf" = 'SEM-DOC-' || "id"
WHERE TRIM("cnpjCpf") = '';
