-- CreateTable
CREATE TABLE "metas_valor" (
    "id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metas_valor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metas_dias_sem_meta" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metas_dias_sem_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metas_valor_vigenteDesde_idx" ON "metas_valor"("vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "metas_dias_sem_meta_data_key" ON "metas_dias_sem_meta"("data");
