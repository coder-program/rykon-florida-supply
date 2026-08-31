'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const client_1 = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new client_1.PrismaClient();
async function main() {
  const senhaHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@floridahortifruti.com.br' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@floridahortifruti.com.br',
      senhaHash,
      papel: client_1.PapelUsuario.ADMINISTRADOR,
    },
  });
  console.log('Usuário administrador criado:', admin.email, '(senha: admin123 - troque depois)');
  await prisma.produto.createMany({
    data: [
      {
        codigoInterno: 'B2',
        nome: 'Caixa de Morango B2',
        unidadeVenda: 'CAIXA',
        precoSugerido: 23.0,
        custo: 15.0,
      },
      {
        codigoInterno: 'B3',
        nome: 'Caixa de Morango B3',
        unidadeVenda: 'CAIXA',
        precoSugerido: 21.0,
        custo: 13.5,
      },
      {
        codigoInterno: 'B3H',
        nome: 'Caixa de Morango B3 Hidropônico',
        unidadeVenda: 'CAIXA',
        precoSugerido: 25.0,
        custo: 17.0,
      },
      {
        codigoInterno: 'PREM',
        nome: 'Morango Premium',
        unidadeVenda: 'CAIXA',
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
//# sourceMappingURL=seed.js.map
