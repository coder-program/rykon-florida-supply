ESCOPO DO SISTEMA DE PEDIDOS, VENDAS E CONTROLE DE ESTOQUE
Flórida Hortifruti
1. OBJETIVO DO PROJETO
Desenvolver um sistema para digitalizar e centralizar o processo de vendas da Flórida Hortifruti, permitindo que os vendedores externos registrem pedidos diretamente pelo celular, enquanto as informações são encaminhadas para o setor administrativo/financeiro.
O sistema deverá reduzir lançamentos manuais, erros de preenchimento e retrabalho, além de permitir que os pedidos gerem movimentações estruturadas de vendas e estoque.
O sistema deverá ser desenvolvido inicialmente com foco em simplicidade e facilidade de uso para vendedores que trabalham na rua, mas com estrutura preparada para futuras integrações e funcionalidades.

2. FLUXO GERAL DO SISTEMA
O fluxo principal esperado é:
VENDEDOR ↓ Seleciona/cadastra cliente ↓ Monta pedido ↓ Confere informações ↓ Envia pedido ↓ ADMINISTRATIVO ↓ Confere/aprova pedido ↓ Pedido gera saída de estoque ↓ Venda é registrada ↓ Financeiro acompanha pagamento ↓ NF pode ser emitida ↓ Pedido é finalizado

3. USUÁRIOS DO SISTEMA
O sistema deverá possuir diferentes níveis de acesso.
3.1 Vendedor
O vendedor deverá conseguir:
    • Acessar o sistema pelo celular;
    • Selecionar clientes cadastrados;
    • Cadastrar novos clientes;
    • Criar pedidos;
    • Adicionar produtos;
    • Informar quantidade;
    • Informar preço negociado;
    • Informar desconto, quando permitido;
    • Informar frete, quando houver;
    • Selecionar forma de pagamento;
    • Informar vencimento;
    • Adicionar observações;
    • Visualizar seus próprios pedidos;
    • Acompanhar o status dos pedidos.
O vendedor não deverá ter acesso à alteração manual do estoque ou às informações financeiras gerais da empresa.

3.2 Administrativo/Financeiro
Deverá conseguir:
    • Visualizar todos os pedidos;
    • Conferir pedidos;
    • Aprovar ou rejeitar pedidos;
    • Alterar informações antes da aprovação;
    • Visualizar vendas;
    • Visualizar estoque;
    • Registrar entradas de estoque;
    • Realizar ajustes de estoque;
    • Acompanhar contas a receber;
    • Consultar clientes;
    • Consultar vendedores;
    • Emitir relatórios;
    • Gerenciar produtos;
    • Gerenciar preços;
    • Visualizar histórico das movimentações.

3.3 Administrador
Terá acesso completo ao sistema, incluindo:
    • Usuários;
    • Permissões;
    • Produtos;
    • Clientes;
    • Estoque;
    • Vendas;
    • Financeiro;
    • Configurações;
    • Relatórios;
    • Integrações.

4. CADASTRO DE CLIENTES
O sistema deverá possuir cadastro de clientes com, no mínimo:
    • Razão social/Nome;
    • CNPJ/CPF;
    • Nome fantasia;
    • Telefone;
    • WhatsApp;
    • E-mail;
    • Endereço;
    • Cidade;
    • Estado;
    • Responsável pelo contato;
    • Condição de pagamento;
    • Forma de pagamento habitual;
    • Necessidade de emissão de NF;
    • Observações.
O vendedor deverá conseguir pesquisar clientes por nome, CNPJ/CPF ou telefone.

5. CADASTRO DE PRODUTOS
Os produtos deverão ser cadastrados previamente pelo administrador.
Cada produto deverá possuir:
    • Código interno;
    • Nome;
    • Categoria;
    • Unidade de venda;
    • Preço sugerido;
    • Custo;
    • Status ativo/inativo.
Produtos iniciais
Exemplos:
    • Caixa de Morango B2;
    • Caixa de Morango B3;
    • Caixa de Morango B3 Hidropônico;
    • Morango Premium.
A unidade de venda deverá ser CAIXA.
O sistema deverá ser preparado para inclusão de novos produtos futuramente.

6. CRIAÇÃO DO PEDIDO PELO VENDEDOR
Essa será uma das principais funcionalidades do sistema.
Ao criar um pedido, o vendedor deverá informar:
Cliente
    • Cliente;
    • Data;
    • Vendedor responsável.
Produtos
Para cada produto:
    • Produto;
    • Quantidade de caixas;
    • Valor unitário;
    • Valor total.
O sistema deverá calcular automaticamente:
Quantidade × Valor unitário = Total do produto
O pedido poderá possuir vários produtos.
Exemplo:
Produto
Quantidade
Valor Unitário
Total
B2
30 caixas
R$ 23,00
R$ 690,00
B3
20 caixas
R$ 21,00
R$ 420,00
Subtotal: R$ 1.110,00

7. PREÇO DE VENDA
A empresa possui uma particularidade importante:
o preço pode variar de acordo com o cliente e/ou negociação realizada pelo vendedor.
Por isso, o sistema não deverá obrigar todos os clientes a utilizarem um único preço fixo.
Deverá existir:
    • Preço sugerido;
    • Possibilidade de alteração do preço pelo vendedor, conforme sua permissão;
    • Registro do preço efetivamente vendido;
    • Histórico do valor praticado.
Idealmente, o sistema deverá registrar quem realizou a alteração do preço.

8. FRETE E DESCONTOS
O pedido deverá permitir:
Frete
    • Valor do frete;
    • Frete incluso no preço ou cobrado separadamente;
    • Observação.
Desconto
    • Desconto em R$ ou %;
    • Valor final após desconto;
    • Registro de quem concedeu o desconto.
O sistema deverá calcular automaticamente:
Subtotal + Frete − Desconto = Total do pedido

9. FORMA DE PAGAMENTO
O vendedor deverá selecionar a forma de pagamento:
    • PIX;
    • Boleto;
    • Dinheiro;
    • Outros.
Caso seja boleto, deverá existir campo para:
    • Data de vencimento;
    • Condição negociada.
Caso seja PIX, poderá ser registrada a informação de pagamento posteriormente pelo administrativo/financeiro.
O sistema deverá diferenciar:
Pago / Em aberto / Vencido

10. NOTA FISCAL
No pedido deverá existir a pergunta:
“Necessita de Nota Fiscal?”
Opções:
    • Sim;
    • Não.
Caso seja “Sim”, o pedido deverá ficar identificado para o setor responsável pela emissão.
O sistema deverá ser desenvolvido de forma que futuramente possa existir integração com o sistema fiscal utilizado pela empresa, incluindo o Conta Azul, caso tecnicamente viável.

11. OBSERVAÇÕES DO PEDIDO
Deverá existir um campo livre para observações.
Exemplos:
    • Horário de entrega;
    • Local específico para entrega;
    • Pedido especial;
    • Produto solicitado pelo cliente;
    • Observações de cobrança;
    • Outras informações importantes.

12. CONFERÊNCIA DO PEDIDO
Antes de enviar, o vendedor deverá visualizar uma tela de resumo contendo:
Cliente:
Vendedor:
Data:
Produtos:
Produto — Quantidade — Valor unitário — Total
Subtotal:
Frete:
Desconto:
Total final:
Forma de pagamento:
Vencimento:
Nota Fiscal: Sim/Não
Observações:
O vendedor deverá confirmar o pedido antes do envio.

13. STATUS DOS PEDIDOS
O sistema deverá possuir status para acompanhamento.
Sugestão:
    1. Rascunho
    2. Enviado
    3. Em conferência
    4. Aprovado
    5. Separação/Entrega
    6. Entregue
    7. Faturado
    8. Pago
    9. Cancelado
Nem todos os status precisam ser obrigatórios na primeira versão, mas a estrutura deverá permitir sua implementação.

14. CONTROLE DE ESTOQUE
O sistema deverá trabalhar com movimentação de estoque.
Entrada
Quando houver compra de produtos, o administrativo deverá conseguir registrar:
    • Data;
    • Fornecedor;
    • Produto;
    • Quantidade;
    • Custo total;
    • Custo unitário;
    • Observação.
O sistema deverá calcular automaticamente:
Custo unitário = Custo total ÷ Quantidade

15. SAÍDA DE ESTOQUE
Quando um pedido for aprovado, o sistema deverá registrar a saída correspondente.
Exemplo:
Pedido 000123:
    • B2 — 30 caixas;
    • B3 — 20 caixas.
O estoque deverá registrar:
Saída: 30 caixas B2
Saída: 20 caixas B3
A saída deverá estar vinculada ao número do pedido e ao cliente.

16. AJUSTE DE ESTOQUE
Deverá existir uma funcionalidade para ajuste manual de estoque pelo administrador.
O ajuste deverá exigir:
    • Produto;
    • Quantidade;
    • Tipo de ajuste;
    • Motivo;
    • Usuário responsável;
    • Data.
Exemplos de motivo:
    • Correção de cadastro;
    • Perda;
    • Avaria;
    • Divergência;
    • Contagem física;
    • Ajuste inicial.
O sistema deverá manter histórico dos ajustes e não simplesmente apagar o saldo anterior.

17. IMPORTANTE — HISTÓRICO DO ESTOQUE
Cada movimentação deverá ficar registrada.
Exemplo:
Data
Tipo
Produto
Quantidade
Origem
20/08
Entrada
B2
+100
Compra
21/08
Saída
B2
-30
Pedido 001
22/08
Saída
B2
-20
Pedido 002
23/08
Ajuste
B2
+5
Correção
Isso permitirá identificar exatamente como o sistema chegou ao estoque atual.

18. ESTOQUE ATUAL
O painel deverá apresentar:
Produto | Estoque Atual
Exemplo:
    • B2 — 50 caixas;
    • B3 — 35 caixas;
    • B3 Hidropônico — 20 caixas;
    • Premium — 15 caixas.
Também deverá existir a possibilidade de configurar um estoque mínimo.
Exemplo:
Estoque mínimo B2: 20 caixas
Se chegar abaixo desse valor, o sistema poderá apresentar um alerta.

19. CONTROLE DE VENDAS
O sistema deverá registrar automaticamente as vendas realizadas.
Filtros desejados:
    • Data;
    • Cliente;
    • Vendedor;
    • Produto;
    • Status;
    • Forma de pagamento.
Informações:
    • Número do pedido;
    • Data;
    • Cliente;
    • Vendedor;
    • Produtos;
    • Quantidade;
    • Valor unitário;
    • Total;
    • Forma de pagamento;
    • Status de pagamento.

20. DASHBOARD ADMINISTRATIVO
A tela inicial do administrador deverá apresentar informações resumidas.
Exemplo:
Vendas do dia
R$ XX.XXX,XX
Caixas vendidas
XXX caixas
Pedidos realizados
XX pedidos
Valores em aberto
R$ XX.XXX,XX
Valores vencidos
R$ X.XXX,XX
Estoque
    • B2: XX caixas
    • B3: XX caixas
    • Premium: XX caixas
O período deverá ser selecionável:
    • Hoje;
    • Ontem;
    • Últimos 7 dias;
    • Últimos 30 dias;
    • Personalizado.

21. RELATÓRIOS
O sistema deverá permitir gerar relatórios de:
Vendas
    • Por dia;
    • Por período;
    • Por vendedor;
    • Por cliente;
    • Por produto.
Estoque
    • Estoque atual;
    • Entradas;
    • Saídas;
    • Ajustes;
    • Histórico.
Financeiro
    • Recebidos;
    • Em aberto;
    • Vencidos;
    • Por forma de pagamento.
Produtos
    • Quantidade vendida;
    • Faturamento por produto;
    • Preço médio de venda;
    • Custo médio.
Os relatórios deverão, preferencialmente, permitir exportação para Excel/CSV.

22. CONTROLE DE CUSTO E RESULTADO
O sistema deverá ser preparado para calcular o resultado das vendas.
Exemplo:
Venda: R$ 2.000,00
Custo dos produtos: R$ 1.200,00
Margem bruta: R$ 800,00
Posteriormente poderá ser acrescentado:
Margem bruta − despesas operacionais = resultado
Essa funcionalidade poderá ser considerada como parte da segunda fase, caso aumente significativamente o custo do projeto.

23. INTEGRAÇÃO COM CONTA AZUL
Como a empresa utiliza o Conta Azul, deverá ser avaliada a possibilidade de integração.
Objetivos futuros:
    • Enviar vendas;
    • Enviar contas a receber;
    • Integrar clientes;
    • Integrar produtos;
    • Auxiliar no processo de emissão de NF;
    • Evitar duplicidade de lançamentos.
O desenvolvedor deverá informar:
    1. Se a integração é tecnicamente possível;
    2. Quais dados podem ser enviados;
    3. Quais dados podem ser recebidos;
    4. Se existe custo adicional;
    5. Se será utilizada API;
    6. Quais limitações existem.
A integração não deve ser considerada obrigatória para o MVP caso aumente muito o prazo/custo, mas o sistema deverá ser desenvolvido pensando nessa possibilidade.

24. FUNCIONAMENTO NO CELULAR
Como os vendedores trabalham externamente, o sistema deverá possuir uma interface responsiva e otimizada para celular.
Prioridades:
    • Poucos cliques;
    • Campos grandes;
    • Fácil seleção de produtos;
    • Pesquisa rápida de clientes;
    • Cálculo automático;
    • Tela simples;
    • Boa utilização pelo celular.
Idealmente, o vendedor deverá conseguir criar um pedido em poucos minutos.

25. INTERNET / CONECTIVIDADE
Deverá ser avaliada a possibilidade de funcionamento em locais com internet instável.
Caso o sistema não tenha funcionamento offline na primeira versão, deverá:
    • Salvar automaticamente um rascunho;
    • Evitar perda das informações preenchidas;
    • Permitir envio assim que a conexão retornar.

26. SEGURANÇA E AUDITORIA
O sistema deverá registrar:
    • Usuário que criou o pedido;
    • Usuário que alterou o pedido;
    • Data e hora;
    • Alterações realizadas;
    • Cancelamentos;
    • Ajustes de estoque;
    • Alterações de preço.
Informações importantes não deverão ser apagadas definitivamente sem registro.

27. MVP — PRIMEIRA VERSÃO
Para evitar que o projeto fique muito grande inicialmente, recomendamos que a primeira versão contenha obrigatoriamente:
    • Login e usuários;
    • Controle de permissões;
    • Cadastro de clientes;
    • Cadastro de produtos;
    • Cadastro de vendedores;
    • Criação de pedidos pelo celular;
    • Quantidade por produto;
    • Preço unitário editável conforme permissão;
    • Cálculo automático do pedido;
    • Frete;
    • Desconto;
    • Forma de pagamento;
    • Data de vencimento;
    • Necessidade de NF;
    • Observações;
    • Envio do pedido;
    • Painel administrativo;
    • Aprovação de pedidos;
    • Controle de entradas de estoque;
    • Controle de saídas;
    • Ajustes de estoque;
    • Histórico de movimentações;
    • Estoque atual;
    • Relatório básico de vendas;
    • Relatório básico de estoque;
    • Status dos pedidos.

28. SEGUNDA FASE
Após o MVP estar funcionando, poderão ser acrescentados:
    • Integração com Conta Azul;
    • Emissão/integração de NF;
    • Contas a receber automatizadas;
    • Comissão dos vendedores;
    • Controle de entregas;
    • Roteirização de vendedores;
    • Geolocalização;
    • Dashboard financeiro avançado;
    • Cálculo de lucro líquido;
    • Relatórios avançados;
    • Funcionamento offline;
    • Aplicativo próprio para Android/iOS;
    • Notificações automáticas;
    • Histórico de preços por cliente;
    • Sugestão automática de preço;
    • Alertas de estoque mínimo.

29. REGRAS DE NEGÓCIO IMPORTANTES
O desenvolvedor deverá considerar as seguintes regras:
Regra 1
A unidade de venda dos produtos atualmente é CAIXA.
Regra 2
A quantidade vendida deverá sempre ser registrada em caixas.
Regra 3
O preço de venda pode variar por cliente e negociação.
Regra 4
O vendedor não deverá conseguir alterar o estoque diretamente.
Regra 5
A saída de estoque deverá estar vinculada ao pedido.
Regra 6
Pedidos cancelados não deverão simplesmente desaparecer. O sistema deverá manter o histórico.
Regra 7
Ajustes de estoque deverão possuir motivo e usuário responsável.
Regra 8
Alterações relevantes deverão ficar registradas no histórico.
Regra 9
O sistema deverá permitir inclusão de novos produtos, vendedores e clientes sem necessidade de alteração do código.
Regra 10
A estrutura deverá permitir futuras integrações com sistemas externos, principalmente o Conta Azul.

30. EXPERIÊNCIA DO VENDEDOR — EXEMPLO PRÁTICO
O vendedor chega ao cliente.
Abre o sistema.
Novo Pedido
Seleciona:
Cliente: Mercado X
Adiciona:
B2 — 30 caixas — R$ 23,00
Adiciona:
B3 — 20 caixas — R$ 21,00
Sistema calcula:
B2 = R$ 690,00
B3 = R$ 420,00
Subtotal = R$ 1.110,00
Frete = R$ 50,00
Total = R$ 1.160,00
Seleciona:
Pagamento: Boleto
Vencimento:
30/08/2026
NF:
Sim
Observação:
“Entregar após as 14h.”
O vendedor confirma.
ENVIAR PEDIDO
O pedido aparece imediatamente no painel administrativo.

31. OBJETIVO FINAL
O sistema deverá substituir gradualmente processos manuais e descentralizados por um fluxo único:
VENDA → PEDIDO → ESTOQUE → FINANCEIRO → NF → RELATÓRIOS
A prioridade inicial é garantir que a informação seja digitada uma única vez, pelo vendedor, e posteriormente aproveitada pelos demais setores.
Dessa forma, a empresa reduz:
    • Digitação duplicada;
    • Erros de informação;
    • Perda de pedidos;
    • Divergências de estoque;
    • Retrabalho administrativo;
    • Falta de informações sobre vendas;
    • Dificuldade para acompanhar valores a receber.
O sistema deverá ser construído de forma modular, permitindo que novas funcionalidades sejam adicionadas conforme a operação da empresa evolua.

32. PERGUNTAS PARA O DESENVOLVEDOR
Antes de aprovar o projeto, solicitar ao desenvolvedor:
    1. Qual tecnologia será utilizada?
    2. Será sistema web, aplicativo ou ambos?
    3. Funcionará no celular dos vendedores?
    4. Funcionará em Android e iPhone?
    5. Haverá necessidade de instalação?
    6. Funcionará sem internet?
    7. Onde os dados ficarão armazenados?
    8. Haverá backup automático?
    9. Como será feita a segurança dos dados?
    10. Quantos usuários poderão utilizar?
    11. Haverá custo mensal de hospedagem?
    12. Haverá custo por usuário?
    13. Existe custo de manutenção?
    14. Como serão feitas atualizações?
    15. É possível integrar com o Conta Azul?
    16. O sistema terá API?
    17. Será possível exportar os dados para Excel?
    18. Qual o prazo para desenvolvimento?
    19. Qual o prazo para implantação?
    20. Qual o valor do MVP?
    21. Qual o valor das funcionalidades da segunda fase?
    22. O suporte após a entrega está incluído?
    23. O código-fonte ficará disponível para a empresa?
    24. Caso a empresa troque de desenvolvedor futuramente, poderá continuar utilizando o sistema?

33. PRIORIDADE DO PROJETO
PRIORIDADE ALTA
Pedido pelo celular + clientes + produtos + preços + pagamento + painel administrativo + estoque.
PRIORIDADE MÉDIA
Relatórios + financeiro + histórico + alertas + exportação.
PRIORIDADE FUTURA
Conta Azul + NF + comissão + logística + aplicativo próprio + automações avançadas.
A recomendação é desenvolver primeiro um MVP funcional, testar com 1 ou 2 vendedores e, após validar o funcionamento na operação real, expandir o sistema.