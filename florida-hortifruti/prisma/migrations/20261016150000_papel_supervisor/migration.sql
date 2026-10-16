-- Supervisor: vendedor com acesso a dashboard, metas, pedidos, solicitações, devoluções, estoque e lotes
ALTER TYPE "PapelUsuario" ADD VALUE IF NOT EXISTS 'SUPERVISOR';
