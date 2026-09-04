import { PrismaClient, PapelUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@floridahortifruti.com.br' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@floridahortifruti.com.br',
      senhaHash,
      papel: PapelUsuario.ADMINISTRADOR,
    },
  });

  console.log('Usuário administrador criado:', admin.email, '(senha: admin123 - troque depois)');

  const motorista = await prisma.usuario.upsert({
    where: { email: 'motorista@floridahortifruti.com.br' },
    update: {},
    create: {
      nome: 'Motorista',
      email: 'motorista@floridahortifruti.com.br',
      senhaHash,
      papel: PapelUsuario.MOTORISTA,
    },
  });
  console.log('Usuário motorista criado:', motorista.email, '(senha: admin123)');

  const morango = await prisma.categoria.upsert({
    where: { nome: 'Morango' },
    update: {},
    create: { nome: 'Morango' },
  });

  await prisma.produto.createMany({
    data: [
      {
        codigoInterno: 'B2',
        nome: 'Caixa de Morango B2',
        unidadeVenda: 'CAIXA',
        categoriaId: morango.id,
        precoSugerido: 23.0,
        custo: 15.0,
      },
      {
        codigoInterno: 'B3',
        nome: 'Caixa de Morango B3',
        unidadeVenda: 'CAIXA',
        categoriaId: morango.id,
        precoSugerido: 21.0,
        custo: 13.5,
      },
      {
        codigoInterno: 'B3H',
        nome: 'Caixa de Morango B3 Hidropônico',
        unidadeVenda: 'CAIXA',
        categoriaId: morango.id,
        precoSugerido: 25.0,
        custo: 17.0,
      },
      {
        codigoInterno: 'PREM',
        nome: 'Morango Premium',
        unidadeVenda: 'CAIXA',
        categoriaId: morango.id,
        precoSugerido: 30.0,
        custo: 20.0,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Produtos de exemplo criados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
