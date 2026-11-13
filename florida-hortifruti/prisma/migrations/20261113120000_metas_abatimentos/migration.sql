-- CreateTable
CREATE TABLE "metas_abatimentos" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "batida" BOOLEAN NOT NULL DEFAULT false,
    "valor" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_abatimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metas_abatimentos_data_key" ON "metas_abatimentos"("data");
