
Prompt final

Entendi o pedido e vou deixar um prompt objetivo para passar para a equipe:

"Precisamos incluir no sistema as seguintes melhorias relacionadas a clientes, compras a prazo e controle de estoque:

1. Perfil de clientes
- Revisar o layout de exibição dos dados de clientes com foco em valores a receber a prazo.
- Essas informações devem ser priorizadas no perfil de administrador/gestão.
- O vendedor deve ver apenas o que for necessário para operação comercial.
- O cliente deve visualizar, no portal do cliente, suas compras, valores pendentes e datas de vencimento.

2. Entradas de mercadoria
- Criar uma aba para registro e controle das entradas de mercadoria por lote.
- Cada lote deve conter data de entrada, número do lote, produto, quantidade e valor.
- Exemplo: 18/09 - lote 1 - 130 caixas B2 - R$35,00.
- A aba deve permitir organização, consulta e acompanhamento do saldo por lote.

3. Fluxo de pedido e baixa automática
- No momento da venda, o vendedor deve selecionar o lote correspondente ao produto.
- O sistema deve realizar a baixa automática de estoque conforme as vendas forem sendo concluídas.
- Quando houver mais de um lote para o mesmo produto, o sistema deve utilizar a lógica de lote com saldo disponível, preferencialmente seguindo a ordem de entrada mais antiga.
- O pedido pode conter itens de diferentes lotes conforme a disponibilidade do estoque.
- A movimentação deve refletir o saldo real do lote no sistema.

4. Notificações para compras a prazo
- Sempre que houver compra a prazo, o cliente deve receber notificação informando que há valor a pagar.
- As notificações devem ser enviadas em 2 momentos:
  - 3 dias antes do vencimento
  - no dia do vencimento, caso o pagamento não tenha sido efetuado
- A notificação deve ocorrer sempre que houver pendência ativa de cobrança, independentemente do perfil do usuário.
- O sistema deve considerar saldo pendente e status do pagamento.

Observação:
- O foco do projeto é controlar os valores a receber, os lotes de entrada, a baixa automática de estoque e as notificações de cobrança para clientes com compra a prazo.
- A lógica de lote e de cobrança deve ser tratada de forma integrada para evitar inconsistência entre estoque, financeiro e comunicação com o cliente."

Definições que eu considero mais adequadas para o projeto

1) Como o sistema deve identificar o lote no pedido
A melhor regra para este projeto é:
- Cada item do pedido deve ser abatido do lote com saldo disponível mais antigo, seguindo a lógica FIFO.
- Se o mesmo produto tiver mais de um lote, o sistema deve usar o lote com maior disponibilidade e/ou mais antigo, respeitando o saldo.
- O pedido pode conter itens de diferentes lotes quando houver mais de um lote disponível para o mesmo produto.
- Se um lote acabar, o sistema continua usando o próximo lote com saldo.

Isso deixa a baixa automática de estoque correta e evita inconsistência no controle de mercadoria.

2) O que significa compra a prazo
Para o projeto, eu definiria assim:
- Compra a prazo = venda com pagamento não realizado no ato da compra.
- A conta a receber deve ser gerada no momento da venda.
- O vencimento pode ser por pedido, por parcela ou por regra financeira da empresa, mas o sistema precisa ter um campo de vencimento e status da cobrança.
- Se houver pagamento parcial, o sistema deve atualizar o saldo pendente e continuar a notificação apenas sobre o valor restante.
- Cliente recebe notificação quando houver pendência ativa.

3) Como funciona a baixa automática
A melhor abordagem é separar os dois conceitos:
- Baixa automática de estoque: ocorre quando o pedido é confirmado, abatendo a quantidade vendida do lote correspondente.
- Baixa automática financeira: ocorre quando o pagamento é registrado, reduzindo o valor pendente do cliente.

Ou seja, uma venda a prazo não significa que não há baixa de estoque. O estoque reduz no momento da venda e a dívida fica registrada até o pagamento.

4) Perfil e visibilidade
Eu recomendo:
- Administrador: visualiza todos os lotes, valores a receber, pendências, vencimentos e histórico.
- Vendedor: visualiza somente o necessário para a operação de venda e acompanhamento do estoque disponível.
- Cliente: acessa no portal somente o que for pertinente ao seu histórico de compras, valores pendentes e vencimentos.
- O cliente não precisa ter acesso ao controle interno de lote, mas precisa ver suas pendências e datas.

Resumo
A regra mais segura para este projeto é tratar lote, estoque, financeiro e notificação como um único fluxo integrado. Isso evita ambiguidade e reduz retrabalho na implementação.