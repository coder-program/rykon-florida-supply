-- Inscrições de Web Push do app do cliente (aviso "pedido a caminho")
CREATE TABLE "push_inscricoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_inscricoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_inscricoes_endpoint_key" ON "push_inscricoes"("endpoint");
CREATE INDEX "push_inscricoes_usuarioId_idx" ON "push_inscricoes"("usuarioId");

ALTER TABLE "push_inscricoes" ADD CONSTRAINT "push_inscricoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
