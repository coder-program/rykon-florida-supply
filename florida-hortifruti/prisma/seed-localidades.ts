import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// O Brasil tem 27 UFs e ~5.570 municípios. Se já estão no banco, não precisa ir ao IBGE:
// assim o arranque da API não depende do IBGE estar no ar (nem do certificado dele).
const TOTAL_ESTADOS = 27;
const MINIMO_CIDADES = 5000;

async function main() {
  const [estadosNoBanco, cidadesNoBanco] = await Promise.all([
    prisma.estado.count(),
    prisma.cidade.count(),
  ]);
  if (estadosNoBanco >= TOTAL_ESTADOS && cidadesNoBanco >= MINIMO_CIDADES) {
    console.log(
      `Localidades já carregadas (${estadosNoBanco} estados, ${cidadesNoBanco} cidades). Nada a fazer.`,
    );
    return;
  }

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
