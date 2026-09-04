-- Status logístico novo (mapeia valores antigos)
CREATE TYPE "StatusPedido_new" AS ENUM (
  'AGUARDANDO_APROVACAO',
  'APROVADO',
  'REJEITADO',
  'EM_SEPARACAO',
  'PRONTO_PARA_ENTREGA',
  'EM_ENTREGA',
  'ENTREGUE',
  'CANCELADO'
);

ALTER TABLE "pedidos" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "pedidos"
  ALTER COLUMN "status" TYPE "StatusPedido_new"
  USING (
    CASE "status"::text
      WHEN 'RASCUNHO' THEN 'AGUARDANDO_APROVACAO'
      WHEN 'ENVIADO' THEN 'AGUARDANDO_APROVACAO'
      WHEN 'EM_CONFERENCIA' THEN 'AGUARDANDO_APROVACAO'
      WHEN 'APROVADO' THEN 'APROVADO'
      WHEN 'SEPARACAO_ENTREGA' THEN 'EM_SEPARACAO'
      WHEN 'ENTREGUE' THEN 'ENTREGUE'
      WHEN 'FATURADO' THEN 'ENTREGUE'
      WHEN 'PAGO' THEN 'ENTREGUE'
      WHEN 'CANCELADO' THEN 'CANCELADO'
      ELSE 'AGUARDANDO_APROVACAO'
    END::"StatusPedido_new"
  );

DROP TYPE "StatusPedido";
ALTER TYPE "StatusPedido_new" RENAME TO "StatusPedido";
ALTER TABLE "pedidos" ALTER COLUMN "status" SET DEFAULT 'AGUARDANDO_APROVACAO';

-- Origem do pedido
CREATE TYPE "OrigemPedido" AS ENUM ('VENDEDOR', 'CLIENTE');
ALTER TABLE "pedidos" ADD COLUMN "origem" "OrigemPedido" NOT NULL DEFAULT 'VENDEDOR';
ALTER TABLE "pedidos" ADD COLUMN "entregadorId" TEXT;
ALTER TABLE "pedidos" ALTER COLUMN "vendedorId" DROP NOT NULL;

CREATE INDEX "pedidos_entregadorId_status_idx" ON "pedidos"("entregadorId", "status");

ALTER TABLE "pedidos"
  ADD CONSTRAINT "pedidos_entregadorId_fkey"
  FOREIGN KEY ("entregadorId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Unidade de venda fechada
CREATE TYPE "UnidadeVenda" AS ENUM ('KG', 'CAIXA', 'UNIDADE', 'SACO', 'BANDEJA', 'DUZIA');

ALTER TABLE "produtos" ALTER COLUMN "unidadeVenda" DROP DEFAULT;
ALTER TABLE "produtos"
  ALTER COLUMN "unidadeVenda" TYPE "UnidadeVenda"
  USING (
    CASE upper(trim("unidadeVenda"))
      WHEN 'KG' THEN 'KG'
      WHEN 'KILO' THEN 'KG'
      WHEN 'QUILO' THEN 'KG'
      WHEN 'CAIXA' THEN 'CAIXA'
      WHEN 'CX' THEN 'CAIXA'
      WHEN 'UNIDADE' THEN 'UNIDADE'
      WHEN 'UN' THEN 'UNIDADE'
      WHEN 'UND' THEN 'UNIDADE'
      WHEN 'SACO' THEN 'SACO'
      WHEN 'BANDEJA' THEN 'BANDEJA'
      WHEN 'DUZIA' THEN 'DUZIA'
      WHEN 'DÚZIA' THEN 'DUZIA'
      ELSE 'CAIXA'
    END::"UnidadeVenda"
  );
ALTER TABLE "produtos" ALTER COLUMN "unidadeVenda" SET DEFAULT 'CAIXA';

-- Categorias
CREATE TABLE "categorias" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");

INSERT INTO "categorias" ("id", "nome")
SELECT gen_random_uuid()::text, c
FROM (
  SELECT DISTINCT trim(categoria) AS c
  FROM "produtos"
  WHERE categoria IS NOT NULL AND trim(categoria) <> ''
) t;

ALTER TABLE "produtos" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "produtos" ADD COLUMN "limiteEstoqueBaixo" DECIMAL(10,2);
ALTER TABLE "produtos" ADD COLUMN "exibirQuantidadeAproximada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "produtos" ADD COLUMN "exibirNoPortalCliente" BOOLEAN NOT NULL DEFAULT true;

UPDATE "produtos" p
SET "categoriaId" = cat.id
FROM "categorias" cat
WHERE p.categoria IS NOT NULL AND trim(p.categoria) = cat.nome;

ALTER TABLE "produtos" DROP COLUMN "categoria";
ALTER TABLE "produtos"
  ADD CONSTRAINT "produtos_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Convite / login do cliente
CREATE TYPE "StatusConviteCliente" AS ENUM ('NAO_CONVIDADO', 'CONVITE_ENVIADO', 'ATIVO');

ALTER TABLE "clientes" ADD COLUMN "usuarioId" TEXT;
ALTER TABLE "clientes" ADD COLUMN "statusConvite" "StatusConviteCliente" NOT NULL DEFAULT 'NAO_CONVIDADO';
ALTER TABLE "clientes" ADD COLUMN "tokenConvite" TEXT;
ALTER TABLE "clientes" ADD COLUMN "tokenConviteExpiraEm" TIMESTAMP(3);

CREATE UNIQUE INDEX "clientes_usuarioId_key" ON "clientes"("usuarioId");
CREATE UNIQUE INDEX "clientes_tokenConvite_key" ON "clientes"("tokenConvite");

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Preço por cliente
CREATE TABLE "precos_cliente" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "precoUnitario" DECIMAL(10,2) NOT NULL,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  "atualizadoPorId" TEXT NOT NULL,
  CONSTRAINT "precos_cliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "precos_cliente_clienteId_produtoId_key" ON "precos_cliente"("clienteId", "produtoId");

ALTER TABLE "precos_cliente"
  ADD CONSTRAINT "precos_cliente_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "precos_cliente"
  ADD CONSTRAINT "precos_cliente_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "precos_cliente"
  ADD CONSTRAINT "precos_cliente_atualizadoPorId_fkey"
  FOREIGN KEY ("atualizadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "historico_precos" ADD COLUMN "clienteId" TEXT;
ALTER TABLE "historico_precos"
  ADD CONSTRAINT "historico_precos_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Comprovante de entrega
CREATE TABLE "comprovantes_entrega" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "motoristaId" TEXT NOT NULL,
  "fotoUrl" TEXT NOT NULL,
  "nomeRecebedor" TEXT NOT NULL,
  "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "observacao" TEXT,
  CONSTRAINT "comprovantes_entrega_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comprovantes_entrega_pedidoId_key" ON "comprovantes_entrega"("pedidoId");

ALTER TABLE "comprovantes_entrega"
  ADD CONSTRAINT "comprovantes_entrega_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comprovantes_entrega"
  ADD CONSTRAINT "comprovantes_entrega_motoristaId_fkey"
  FOREIGN KEY ("motoristaId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "comprovantes_entrega" (
  "id", "pedidoId", "motoristaId", "fotoUrl", "nomeRecebedor", "dataHora", "observacao"
)
SELECT
  gen_random_uuid()::text,
  p.id,
  COALESCE(p."entregadorId", p."vendedorId"),
  COALESCE(p."fotoEntrega", ''),
  COALESCE(NULLIF(trim(p."recebidoPor"), ''), 'Não informado'),
  COALESCE(p."entregueEm", p."atualizadoEm"),
  p."observacaoEntrega"
FROM "pedidos" p
WHERE p.status = 'ENTREGUE'
  AND (p."fotoEntrega" IS NOT NULL OR p."recebidoPor" IS NOT NULL)
  AND COALESCE(p."entregadorId", p."vendedorId") IS NOT NULL;
