import { BadRequestException } from '@nestjs/common';

// Dias contados no fuso de Brasília (o servidor roda em UTC)
const FUSO = 'America/Sao_Paulo';

export function hojeEmBrasilia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date()); // YYYY-MM-DD
}

/**
 * Data em que a venda/pagamento realmente aconteceu (YYYY-MM-DD), informada por quem lança.
 * Vazio ou hoje = agora; dia anterior = meio-dia de Brasília, para cair no dia certo em
 * relatórios e metas qualquer que seja o fuso da consulta. Data futura é recusada.
 */
export function dataEfetiva(dia: string | undefined, rotulo: string) {
  if (!dia) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new BadRequestException(`${rotulo} inválida`);
  const hoje = hojeEmBrasilia();
  if (dia > hoje) throw new BadRequestException(`${rotulo} não pode ser no futuro`);
  if (dia === hoje) return new Date();
  return new Date(`${dia}T12:00:00-03:00`);
}
