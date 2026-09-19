Preciso adicionar dois novos perfis ao sistema Flórida Hortifruti (NestJS +
Prisma + PostgreSQL): MOTORISTA e CLIENTE. Ambos terão frontends PWA mobile
próprios e separados (não reaproveitam o app do vendedor nem o painel admin),
mas consomem o MESMO backend/API já existente, cada um enxergando só o que
seu papel permite. Antes de alterar código, analisar a
arquitetura, entidades, endpoints, autenticação e fluxo de pedidos já
existentes, e reaproveitar o máximo possível — não duplicar regra de negócio.
Todas as regras críticas (preço final, aprovação, atribuição de entrega,
autorização por dado) ficam SOMENTE no backend. Nenhum frontend deve ser
responsável por decidir o que o usuário pode ou não ver/fazer.

CONTEXTO ATUAL
PapelUsuario hoje tem VENDEDOR, ADMINISTRATIVO, ADMINISTRADOR. Pedido tem um
fluxo de status (ENVIADO -> APROVADO -> SEPARACAO_ENTREGA -> ENTREGUE -> ...).

═══════════════════════════════════════
1. MUDANÇAS NO SCHEMA (breaking changes — atenção)
═══════════════════════════════════════

1.1. PapelUsuario ganha CLIENTE e MOTORISTA:
enum PapelUsuario { VENDEDOR ADMINISTRATIVO ADMINISTRADOR MOTORISTA CLIENTE }

1.2. StatusPedido é RENOMEADO/expandido para bater exatamente com o fluxo de
negócio definido. Isso é breaking change no enum atual — ajustar todo lugar
que referencia os valores antigos (ENVIADO, EM_CONFERENCIA, SEPARACAO_ENTREGA,
FATURADO, PAGO):
enum StatusPedido {
  AGUARDANDO_APROVACAO
  APROVADO
  REJEITADO
  EM_SEPARACAO
  PRONTO_PARA_ENTREGA
  EM_ENTREGA
  ENTREGUE
  CANCELADO
}
StatusPagamento continua separado e não muda (PAGO/EM_ABERTO/VENCIDO já
cobre o controle financeiro, que é independente do status logístico).

1.3. Unidade de venda vira enum fechado (hoje é string livre em Produto):
enum UnidadeVenda { KG CAIXA UNIDADE SACO BANDEJA DUZIA }
Alterar Produto.unidadeVenda de String para UnidadeVenda.

1.4. Categoria vira entidade própria (hoje não existe estrutura de categoria):
model Categoria {
  id       String    @id @default(uuid())
  nome     String    @unique
  produtos Produto[]
  @@map("categorias")
}
Adicionar categoriaId String? e relação categoria Categoria? em Produto.

1.5. Disponibilidade é CALCULADA, nunca armazenada como valor fixo visível
ao cliente. Adicionar em Produto:
  limiteEstoqueBaixo         Decimal? @db.Decimal(10,2)  // abaixo disso = "pouca quantidade"
  exibirQuantidadeAproximada Boolean  @default(false)     // se true, mostra "~100 kg" além do semáforo
Regra de cálculo (implementar em ProdutosService, não no frontend):
  saldo <= 0                    -> INDISPONIVEL
  saldo <= limiteEstoqueBaixo   -> POUCA_QUANTIDADE
  saldo > limiteEstoqueBaixo    -> DISPONIVEL
enum StatusDisponibilidade { DISPONIVEL POUCA_QUANTIDADE INDISPONIVEL }

1.6. Preço por cliente — nova tabela para consulta rápida do preço atual
negociado (o HistoricoPreco existente continua guardando todo o histórico
de alterações, agora também associável a um cliente específico):
model PrecoCliente {
  id              String   @id @default(uuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  produtoId       String
  produto         Produto  @relation(fields: [produtoId], references: [id])
  precoUnitario   Decimal  @db.Decimal(10,2)
  atualizadoEm    DateTime @updatedAt
  atualizadoPorId String
  atualizadoPor   Usuario  @relation(fields: [atualizadoPorId], references: [id])
  @@unique([clienteId, produtoId])
  @@map("precos_cliente")
}
Adicionar clienteId String? opcional em HistoricoPreco (nulo = mudança no
preço sugerido geral; preenchido = mudança de preço específico de um
cliente). Toda alteração em PrecoCliente deve gerar automaticamente um
registro em HistoricoPreco — nunca alterar um sem o outro (usar transação).

1.7. Cliente ganha vínculo com login e controle de convite:
  usuarioId           String?   @unique
  usuario             Usuario?  @relation(fields: [usuarioId], references: [id])
  statusConvite        StatusConviteCliente @default(NAO_CONVIDADO)
  tokenConvite         String?  @unique
  tokenConviteExpiraEm DateTime?
enum StatusConviteCliente { NAO_CONVIDADO CONVITE_ENVIADO ATIVO }

1.8. Pedido:
  vendedorId    String?           // deixa de ser obrigatório
  entregadorId  String?           // FK para Usuario com papel MOTORISTA
  origem        OrigemPedido      @default(VENDEDOR)
  status        StatusPedido      @default(AGUARDANDO_APROVACAO)
enum OrigemPedido { VENDEDOR CLIENTE }

1.9. Comprovante de entrega (nova tabela):
model ComprovanteEntrega {
  id            String   @id @default(uuid())
  pedidoId      String   @unique
  pedido        Pedido   @relation(fields: [pedidoId], references: [id])
  motoristaId   String
  motorista     Usuario  @relation(fields: [motoristaId], references: [id])
  fotoUrl       String
  nomeRecebedor String
  dataHora      DateTime @default(now())   // NUNCA aceitar essa data vinda do body
  latitude      Float?
  longitude     Float?
  @@map("comprovantes_entrega")
}

Gerar a migration cobrindo tudo isso. Escrever também um script único de
migração de dados para mapear os valores antigos de StatusPedido para os
novos (ex: ENVIADO -> AGUARDANDO_APROVACAO, SEPARACAO_ENTREGA -> EM_SEPARACAO)
nos pedidos já existentes, antes de aplicar o enum novo.

═══════════════════════════════════════
2. FLUXO DE ATIVAÇÃO DE ACESSO DO CLIENTE
═══════════════════════════════════════

Sem cadastro público. Fluxo: admin cadastra cliente -> admin ativa acesso ->
cliente recebe convite -> cliente define senha -> cliente entra no PWA.

- POST /clientes/:id/ativar-acesso — restrito a ADMINISTRATIVO/ADMINISTRADOR.
  Gera tokenConvite (uuid, expira em 48h), seta statusConvite =
  CONVITE_ENVIADO. Retornar o link de convite na resposta (o envio real por
  WhatsApp/e-mail fica para integração futura — por ora, o admin copia e
  envia manualmente).
- POST /auth/definir-senha — rota pública. Body: { token, senha }. Valida
  token e validade, cria um Usuario (papel CLIENTE, email = e-mail do
  cliente), vincula em Cliente.usuarioId, seta statusConvite = ATIVO. Se o
  token já foi usado ou expirou, retornar erro claro.
- Reaproveitar o AuthService/login já existente — não criar fluxo de login
  paralelo para cliente.

═══════════════════════════════
PERFIL MOTORISTA
═══════════════════════════════
Escopo mínimo: o motorista só precisa ver os pedidos que foram atribuídos a
ele para entrega, e para cada um: registrar que entregou, tirando uma foto,
anotando o nome de quem recebeu e a data/hora (capturada automaticamente,
não digitada).

MODELO DE DADOS
1. Adicionar MOTORISTA ao enum PapelUsuario.
2. Adicionar campo opcional entregadorId em Pedido (FK para Usuario), setado
   pelo admin/administrativo ao atribuir a entrega. Endpoint novo:
   POST /pedidos/:id/atribuir-entregador (body: { entregadorId }), restrito
   a ADMINISTRATIVO e ADMINISTRADOR, só permitido quando status = APROVADO
   ou SEPARACAO_ENTREGA.
3. Criar model ComprovanteEntrega:
   model ComprovanteEntrega {
     id            String   @id @default(uuid())
     pedidoId      String   @unique
     pedido        Pedido   @relation(fields: [pedidoId], references: [id])
     motoristaId   String
     motorista     Usuario  @relation(fields: [motoristaId], references: [id])
     fotoUrl       String
     nomeRecebedor String
     dataHora      DateTime @default(now())
     latitude      Float?
     longitude     Float?
     observacao    String?
     @@map("comprovantes_entrega")
   }
4. Ao registrar o comprovante, o Pedido muda automaticamente de status para
   ENTREGUE (envolver em transação: cria o comprovante + atualiza status).

ENDPOINTS (restritos ao papel MOTORISTA via RolesGuard)
- GET /motorista/entregas — lista só os pedidos onde entregadorId = usuário
  logado e status está em (APROVADO, SEPARACAO_ENTREGA). Retornar o mínimo
  necessário: número do pedido, cliente, endereço de entrega, itens,
  telefone do cliente (para contato). NÃO retornar dados financeiros
  (subtotal, forma de pagamento, etc.) — o motorista não precisa disso.
- GET /motorista/entregas/:id — detalhe de uma entrega específica.
- POST /motorista/entregas/:id/confirmar — multipart/form-data com a foto
  (salvar em storage compatível com S3 — usar um provider genérico via
  variável de ambiente, não travar num serviço específico) + nomeRecebedor
  no body. Captura data/hora e, se o app enviar, latitude/longitude do
  dispositivo. Cria o ComprovanteEntrega e atualiza o status do pedido.

FRONTEND (novo projeto PWA separado, mobile-first)
- Tela 1: lista de entregas do dia (cards simples: número do pedido, nome
  do cliente, endereço, botão "ver detalhes").
- Tela 2: detalhe da entrega (itens do pedido, endereço, botão de navegação
  externa tipo "abrir no Google Maps" usando o endereço).
- Tela 3: confirmação de entrega — captura de foto via <input capture="environment">
  ou getUserMedia, campo de texto para nome de quem recebeu, botão
  "Confirmar entrega".
- Sem tela de login elaborada: só email/senha simples, sessão persistente
  (o motorista não deve precisar logar toda hora).

═══════════════════════════════
PERFIL CLIENTE
═══════════════════════════════
Escopo mínimo: o cliente vê os produtos disponíveis com a quantidade em
estoque, monta um pedido simples (tipo carrinho de compras) e envia — isso
cai automaticamente para o admin aprovar, reaproveitando o fluxo de
aprovação que já existe para pedidos feitos por vendedor.

MODELO DE DADOS
1. Adicionar CLIENTE ao enum PapelUsuario.
2. Adicionar campo opcional usuarioId em Cliente (FK única para Usuario) —
   vincula um cadastro de Cliente (feito hoje pelo vendedor/admin) a uma
   conta de login, para o mesmo cliente não ser cadastrado duas vezes
   quando ganhar acesso ao app.
3. Em Pedido, tornar vendedorId opcional (hoje é obrigatório) e adicionar
   um enum OrigemPedido { VENDEDOR, CLIENTE } para diferenciar quem criou.
   Quando origem = CLIENTE, vendedorId fica nulo até um vendedor ou o admin
   assumir o acompanhamento, se for o caso.
4. Adicionar um campo opcional exibirNoPortalCliente (Boolean, default true)
   em Produto, para o admin poder ocultar produtos específicos do catálogo
   do cliente sem desativá-los do sistema todo.

ENDPOINTS (restritos ao papel CLIENTE via RolesGuard)
- GET /portal-cliente/produtos — lista produtos com exibirNoPortalCliente =
  true e ativo = true, incluindo nome, unidade de venda, preço (se a
  empresa decidir mostrar preço nessa fase — deixar isso como flag de
  configuração) e quantidade disponível (calculada via saldo do
  EstoqueService). NÃO expor custo nem margem.
- POST /portal-cliente/pedidos — cria um pedido com origem = CLIENTE,
  clienteId = cliente vinculado ao usuário logado (nunca aceitar clienteId
  vindo do body — sempre resolver a partir do usuário autenticado, para um
  cliente nunca conseguir criar pedido em nome de outro). Reaproveita a
  mesma lógica de cálculo (subtotal, frete se aplicável) do
  PedidosService.create já existente.
- GET /portal-cliente/pedidos — lista só os pedidos do próprio cliente
  logado, com status, para ele acompanhar.

FRONTEND (novo projeto PWA separado, mobile-first, tom mais "loja simples")
- Tela 1: catálogo de produtos (grid ou lista, foto se houver, nome,
  unidade, quantidade disponível, preço se aplicável).
- Tela 2: carrinho — adicionar/remover quantidade por produto, ver total
  estimado.
- Tela 3: confirmação de pedido — poucos campos (observação opcional),
  botão "Enviar pedido". Sem digitar endereço/dados de entrega toda vez —
  usar o endereço já cadastrado do cliente (tabela Endereco criada
  anteriormente).
- Tela 4: "meus pedidos" — status simples, sem detalhes técnicos internos.
- Login simples (a definir com o time: acesso criado pelo admin ao cadastrar
  o cliente, ou autoatendimento — não implementar cadastro público ainda).


═══════════════════════════════════════
5. AJUSTES NO MÓDULO DE PEDIDOS JÁ EXISTENTE (admin/vendedor)
═══════════════════════════════════════

- PUT /pedidos/:id/itens — permite ADMINISTRATIVO/ADMINISTRADOR ajustar
  quantidade e valorUnitario dos itens antes da aprovação (recalcula
  subtotal/total automaticamente). Só permitido enquanto status =
  AGUARDANDO_APROVACAO.
- POST /pedidos/:id/aprovar — ajustar para o novo status inicial
  AGUARDANDO_APROVACAO -> APROVADO. Mantém a lógica já existente de gerar
  etiqueta (a saída de estoque real eu recomendo mover para o momento em
  que o pedido entra em EM_SEPARACAO ou EM_ENTREGA, não na aprovação —
  porque em hortifruti a separação pode alterar a quantidade real
  disponível; se preferirem manter a saída no momento da aprovação, me
  avisem que ajusto).
- POST /pedidos/:id/rejeitar — novo endpoint, muda status para REJEITADO,
  exige motivo (String) no body.
- POST /pedidos/:id/atribuir — body: { vendedorId } OU { entregadorId },
  restrito a ADMINISTRATIVO/ADMINISTRADOR, só permitido a partir de
  APROVADO.

═══════════════════════════════════════
6. FRONTENDS (dois novos projetos PWA, mobile-first, separados do admin e do vendedor)
═══════════════════════════════════════

CLIENTE — menu inferior fixo: Produtos | Pedidos | Carrinho | Conta.
- Produtos: busca + filtro por categoria, card com nome, preço "/unidade",
  semáforo de disponibilidade (+ quantidade aproximada quando aplicável),
  botão Adicionar.
- Carrinho: lista de itens com quantidade editável, "Subtotal estimado" em
  destaque, texto fixo "Valores sujeitos à confirmação no fechamento do
  pedido.", botão Fazer Pedido.
- Pedidos: histórico com status em texto simples (sem jargão técnico).
- Conta: dados da empresa (somente leitura) + logout.

MOTORISTA — fluxo linear, sem menu de navegação:
- Tela única "Entregas de hoje": lista de cards (número do pedido, cliente,
  endereço, qtd de itens, status).
- Detalhe da entrega: lista de produtos, botão "Abrir no mapa" (deep link
  pro Google Maps com o endereço), botão "Iniciar entrega".
- Confirmação: campo nome de quem recebeu, captura de foto (input
  capture="environment" ou getUserMedia), data/hora exibidas mas travadas
  (geradas pelo app no momento do envio), botão "Confirmar entrega".

Ambos: PWA instalável (manifest.json + service worker básico de cache de
assets), sem necessidade de suporte offline completo nesta fase. Preparar a
estrutura (nomes de rotas, contratos de API) pensando que CLIENTE e
MOTORISTA podem virar apps nativos no futuro sem mudar o backend.

═══════════════════════════════════════
7. SEGURANÇA (transversal a tudo acima)
═══════════════════════════════════════

- RolesGuard já existente continua sendo a primeira camada (papel correto
  para o módulo).
- Adicionar uma segunda camada de verificação de posse do recurso dentro de
  cada service do PortalClienteModule e MotoristaModule (comparar
  clienteId/entregadorId do recurso com o usuário autenticado) — não
  confiar somente no filtro do RolesGuard, que só valida o papel, não o
  dono do dado.
- Nenhuma rota nova destes dois módulos deve aceitar um id de cliente ou de
  motorista vindo do body/query — sempre resolvido a partir do JWT.

  TAREFA GERAL
- Atualizar schema.prisma com todos os itens acima e gerar a migration.
- Criar os módulos MotoristaModule e PortalClienteModule reaproveitando
  EstoqueService, EtiquetasService e PedidosService já existentes — não
  duplicar lógica de cálculo de pedido nem de estoque.
- Garantir, em ambos os módulos, que o RolesGuard bloqueia qualquer rota
  desses módulos para papéis que não sejam o esperado (MOTORISTA só acessa
  /motorista/*, CLIENTE só acessa /portal-cliente/*).
- Ambos os frontends devem ser PWAs instaláveis (manifest.json, service
  worker básico para cache de assets) mas não precisam de suporte offline
  completo nesta fase — isso fica para uma fase futura, quando também
  devem evoluir para apps nativos usando a mesma API.