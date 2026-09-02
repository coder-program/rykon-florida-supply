/*
  Warnings:

  - You are about to drop the column `cidade` on the `clientes` table. All the data in the column will be lost.
  - You are about to drop the column `endereco` on the `clientes` table. All the data in the column will be lost.
  - You are about to drop the column `estado` on the `clientes` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TipoEntidadeEndereco" AS ENUM ('CLIENTE', 'USUARIO', 'FORNECEDOR');

-- CreateEnum
CREATE TYPE "TipoEndereco" AS ENUM ('PRINCIPAL', 'ENTREGA', 'COBRANCA');

-- AlterTable
ALTER TABLE "clientes" DROP COLUMN "cidade",
DROP COLUMN "endereco",
DROP COLUMN "estado";

-- CreateTable
CREATE TABLE "estados" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,

    CONSTRAINT "estados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cidades" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estadoId" TEXT NOT NULL,

    CONSTRAINT "cidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos" (
    "id" TEXT NOT NULL,
    "entidadeTipo" "TipoEntidadeEndereco" NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "tipo" "TipoEndereco" NOT NULL DEFAULT 'PRINCIPAL',
    "principal" BOOLEAN NOT NULL DEFAULT true,
    "cep" TEXT,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidadeId" TEXT NOT NULL,
    "pontoReferencia" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estados_nome_key" ON "estados"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "estados_sigla_key" ON "estados"("sigla");

-- CreateIndex
CREATE INDEX "cidades_estadoId_idx" ON "cidades"("estadoId");

-- CreateIndex
CREATE UNIQUE INDEX "cidades_nome_estadoId_key" ON "cidades"("nome", "estadoId");

-- CreateIndex
CREATE INDEX "enderecos_entidadeTipo_entidadeId_idx" ON "enderecos"("entidadeTipo", "entidadeId");

-- AddForeignKey
ALTER TABLE "cidades" ADD CONSTRAINT "cidades_estadoId_fkey" FOREIGN KEY ("estadoId") REFERENCES "estados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_cidadeId_fkey" FOREIGN KEY ("cidadeId") REFERENCES "cidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
