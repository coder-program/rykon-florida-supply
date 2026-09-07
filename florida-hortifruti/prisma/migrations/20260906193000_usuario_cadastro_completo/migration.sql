ALTER TABLE "usuarios"
ADD COLUMN "cpf" TEXT,
ADD COLUMN "dataNascimento" TIMESTAMP(3),
ADD COLUMN "telefone" TEXT,
ADD COLUMN "whatsapp" TEXT;

CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");