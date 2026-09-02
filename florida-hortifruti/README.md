# Flórida Hortifruti — API

Esqueleto do backend (NestJS + Prisma + PostgreSQL) do sistema de pedidos, vendas,
controle de estoque e etiquetas/QR Code, baseado no escopo funcional definido.

## Setup inicial

```bash
npm install

# suba um PostgreSQL local (ou use um serviço gerenciado) e configure a URL
cp .env.example .env
# edite o .env com sua DATABASE_URL, JWT_SECRET, etc.

npx prisma migrate dev --name init   # cria as tabelas
npx prisma db seed                    # cria o usuário admin + produtos de exemplo

npm run start:dev
```

Login inicial: `admin@floridahortifruti.com.br` / `admin123` (troque depois).

## Endereços e localidades

O banco passou a usar uma estrutura compartilhada para endereço:

- `Estado` e `Cidade` são tabelas fixas e referenciadas por chave estrangeira.
- `Endereco` é compartilhado por qualquer entidade que precise do campo.
- `Cliente`, `Usuario` e demais entidades só armazenam a chave da entidade e não mais texto livre de cidade/estado.

### Seed de localidades (IBGE)

O seed de municípios é pesado, com cerca de 5 mil cidades. Ele deve rodar uma única vez, fora do `migrate`, para não tornar a criação do banco lenta ou redundante.

```bash
npx ts-node prisma/seed-localidades.ts
```

Esse script é idempotente: `createMany({ skipDuplicates: true })` evita duplicidade ao rodar novamente.

### Contrato dos endpoints de localidades

Os endpoints abaixo alimentam o combo dependente do frontend:

- `GET /localidades/estados` -> retorna `[{ id, nome, sigla }]`, ordenados por nome.
- `GET /localidades/estados/:estadoId/cidades` -> retorna `[{ id, nome, estadoId }]`, ordenados por nome.

Fluxo recomendado:

1. Carregar `GET /localidades/estados`
2. Ao escolher um estado, chamar `GET /localidades/estados/:estadoId/cidades`
3. Preencher o select de cidades com os resultados

### Extensão para novas entidades

Qualquer entidade nova que precise de endereço precisa apenas incluir um valor novo no enum `TipoEntidadeEndereco` e usar o módulo de endereços com `entidadeTipo` + `entidadeId`.

## O que já está pronto

- **Modelo de dados completo** (`prisma/schema.prisma`) cobrindo usuários, clientes,
  produtos, pedidos, itens, movimentações de estoque, histórico de preço, etiquetas
  e log de auditoria.
- **Autenticação JWT** com papéis (`vendedor`, `administrativo`, `administrador`)
  e um `RolesGuard` reutilizável.
- **Módulo de clientes** — CRUD completo com busca por nome/CNPJ/telefone.
- **Módulo de produtos** — CRUD restrito a administrador, leitura liberada.
- **Módulo de estoque** — entrada, saída, ajuste e histórico, sempre por
  movimentação (nunca sobrescreve saldo).
- **Módulo de pedidos** — criação com cálculo automático (subtotal, frete,
  desconto, total) e fluxo de aprovação que dispara saída de estoque + geração
  de etiqueta.
- **Módulo de etiquetas** — geração de QR Code e rota pública (`/p/:token`)
  que oculta valores financeiros.

## O que falta (de propósito — é a parte que você vai codar)

Marcado com `TODO` no código, mas resumindo o roteiro sugerido:

1. **Transação na aprovação do pedido** (`pedidos.service.ts`) — envolver saída
   de estoque + mudança de status + geração de etiqueta em `prisma.$transaction`,
   para não deixar o sistema inconsistente se algo falhar no meio.
2. **Log de auditoria** — criar um `AuditoriaService` simples e chamá-lo nos
   pontos-chave: aprovação de pedido, alteração de preço, ajuste de estoque,
   cancelamento (itens 26 e 29 do escopo).
3. **Filtro "meus pedidos"** no `PedidosController.findAll` — vendedor só vê
   os próprios pedidos; administrativo/admin veem todos.
4. **Histórico de preço por cliente** — ao alterar `valorUnitario` num item de
   pedido, registrar em `HistoricoPreco` quem alterou (item 7 do escopo).
5. **Rascunho automático** — no frontend (PWA), salvar o pedido em progresso
   localmente e sincronizar quando a conexão voltar (item 25 do escopo).
6. **Geração do PDF/imagem da etiqueta térmica** — usar o `urlPublica` e os
   dados do pedido para montar o layout final em formato compatível com
   impressora ESC/POS.
7. **Dashboard e relatórios** (itens 20 e 21) — endpoints de agregação sobre
   pedidos/estoque, com filtros por período.
8. **Testes** — nada de testes ainda; comece pelo `PedidosService`, é onde
   mora a lógica de cálculo mais sensível a bugs.

## Ordem de implementação sugerida

1. Auth + usuários (já pronto, só ajustar telas)
2. Clientes + produtos (já prontos)
3. Pedidos: criação (pronto) → tela de conferência → aprovação (parcial, ver TODOs)
4. Estoque: entradas manuais → visualização de saldo/histórico
5. Etiqueta + QR Code (pronto o backend, falta o frontend da página pública e o layout de impressão)
6. Dashboard e relatórios
7. Segunda fase: Conta Azul, NF, comissão, offline, etc.
