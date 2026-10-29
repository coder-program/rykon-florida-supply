-- Acompanhamento das entregas: posição do motorista, ponto do endereço e ordem da rota
CREATE TABLE "localizacoes_motorista" (
    "usuarioId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precisao" DOUBLE PRECISION,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "localizacoes_motorista_pkey" PRIMARY KEY ("usuarioId")
);

ALTER TABLE "localizacoes_motorista" ADD CONSTRAINT "localizacoes_motorista_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enderecos" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "enderecos" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "enderecos" ADD COLUMN "geocodificadoEm" TIMESTAMP(3);

ALTER TABLE "pedidos" ADD COLUMN "ordemRota" INTEGER;
