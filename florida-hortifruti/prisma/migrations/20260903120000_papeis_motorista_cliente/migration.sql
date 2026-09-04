-- Adiciona papéis novos. Precisa commitar antes de usá-los em INSERTs.
ALTER TYPE "PapelUsuario" ADD VALUE IF NOT EXISTS 'MOTORISTA';
ALTER TYPE "PapelUsuario" ADD VALUE IF NOT EXISTS 'CLIENTE';
