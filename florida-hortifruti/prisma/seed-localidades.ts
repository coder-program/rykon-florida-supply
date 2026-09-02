import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const estadosResponse = await fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/estados',
  );
  const estados = (await estadosResponse.json()) as Array<{
    id: number;
    nome: string;
    sigla: string;
  }>;

  if (!Array.isArray(estados) || estados.length === 0) {
    throw new Error('Não foi possível carregar os estados do IBGE');
  }

  for (const estado of estados) {
    await prisma.estado.upsert({
      where: { sigla: estado.sigla },
      update: { nome: estado.nome },
      create: { nome: estado.nome, sigla: estado.sigla },
    });

    const estadoDb = await prisma.estado.findUnique({ where: { sigla: estado.sigla } });
    const cidadesResponse = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado.id}/municipios`,
    );
    const cidades = (await cidadesResponse.json()) as Array<{ nome: string }>;

    if (!Array.isArray(cidades)) continue;

    const payload = cidades.map((cidade) => ({
      nome: cidade.nome,
      estadoId: estadoDb!.id,
    }));

    await prisma.cidade.createMany({
      data: payload,
      skipDuplicates: true,
    });
  }

  console.log(`Seed de localidades concluído: ${estados.length} estados carregados.`);
}

main()
  .catch((error) => {
    console.error('Erro ao popular localidades:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
