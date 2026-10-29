-- Aportes de sócios na empresa e as devoluções (totais ou parciais) desses valores
CREATE TABLE "investimentos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investimentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "devolucoes_investimento" (
    "id" TEXT NOT NULL,
    "investimentoId" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devolucoes_investimento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "devolucoes_investimento_investimentoId_idx" ON "devolucoes_investimento"("investimentoId");

ALTER TABLE "investimentos" ADD CONSTRAINT "investimentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "devolucoes_investimento" ADD CONSTRAINT "devolucoes_investimento_investimentoId_fkey" FOREIGN KEY ("investimentoId") REFERENCES "investimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "devolucoes_investimento" ADD CONSTRAINT "devolucoes_investimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
