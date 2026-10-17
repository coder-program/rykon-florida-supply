-- Visão geral: TV do salão, só leitura do dashboard e das metas
ALTER TYPE "PapelUsuario" ADD VALUE IF NOT EXISTS 'VISAO_GERAL';
