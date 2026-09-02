import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany({
    where: {
      OR: [
        { endereco: { not: null } },
        { cidade: { not: null } },
        { estado: { not: null } },
      ],
    },
  });

  const csvPath = path.join(process.cwd(), 'logs', 'clientes-enderecos-manual.csv');
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });

  const linhas: string[] = ['clienteId,razaoSocialOuNome,enderecoOriginal,estadoOriginal,cidadeOriginal,motivo'];
  let totalMigrados = 0;

  for (const cliente of clientes) {
    const enderecoTexto = (cliente.endereco ?? '').trim();
    const cidadeTexto = (cliente.cidade ?? '').trim();
    const estadoTexto = (cliente.estado ?? '').trim();

    if (!enderecoTexto && !cidadeTexto && !estadoTexto) continue;

    if (!cidadeTexto || !estadoTexto) {
      linhas.push(`${cliente.id},${cliente.razaoSocialOuNome},${JSON.stringify(enderecoTexto)},${JSON.stringify(estadoTexto)},${JSON.stringify(cidadeTexto)},"Sem cidade/estado para casar"`);
      continue;
    }

    const estado = await prisma.estado.findFirst({
      where: { sigla: { equals: estadoTexto, mode: 'insensitive' } },
    });

    if (!estado) {
      linhas.push(`${cliente.id},${cliente.razaoSocialOuNome},${JSON.stringify(enderecoTexto)},${JSON.stringify(estadoTexto)},${JSON.stringify(cidadeTexto)},"Estado não encontrado"`);
      continue;
    }

    const cidade = await prisma.cidade.findFirst({
      where: {
        nome: { equals: cidadeTexto, mode: 'insensitive' },
        estadoId: estado.id,
      },
    });

    if (!cidade) {
      linhas.push(`${cliente.id},${cliente.razaoSocialOuNome},${JSON.stringify(enderecoTexto)},${JSON.stringify(estadoTexto)},${JSON.stringify(cidadeTexto)},"Cidade não encontrada para o estado"`);
      continue;
    }

    await prisma.endereco.create({
      data: {
        entidadeTipo: 'CLIENTE',
        entidadeId: cliente.id,
        tipo: 'PRINCIPAL',
        principal: true,
        cep: null,
        logradouro: enderecoTexto || 'Não informado',
        numero: null,
        complemento: null,
        bairro: null,
        cidadeId: cidade.id,
        pontoReferencia: null,
      },
    });

    totalMigrados += 1;
  }

  fs.writeFileSync(csvPath, linhas.join('\n'));
  console.log(`Migração concluída. ${totalMigrados} clientes migrados. Relatório em ${csvPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
