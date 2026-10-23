[15:20, 10/23/2026] +55 11 91205-0672: mais uma alteraçãoo
[15:21, 10/23/2026] +55 11 91205-0672: na hora de lançar um novo pedido, na opção de selecione o cliente talve4s podemos experiementar um teclado, assim nao precisavamos ficar rolando a telaaa
[15:29, 10/23/2026] +55 11 91205-0672: mais outra alteração também
[15:32, 10/23/2026] +55 11 91205-0672: Percebi que o sistema não está dando baixa automática no estoque conforme vou registrando os pedidos de venda.

Gostaria de implementar um controle automático de estoque por lote.

Por exemplo, o lote 53 possui 51 caixas disponíveis. Já registrei 4 vendas, que totalizam 28 caixas. Portanto, o saldo disponível deveria ser de 23 caixas.

Atualmente, o sistema permite que eu registre novos pedidos com uma quantidade superior ao saldo disponível, sem alertar sobre a falta de estoque.

Minha sugestão é:
- Ao criar um novo pedido, o sistema deve mostrar a quantidade de caixas disponíveis no lote selecionado.
- Conforme os pedidos forem registrados, as quantidades vendidas devem ser descontadas automaticamente do estoque do respectivo lote.
- Caso eu tente registrar um pedido com uma quantidade superior à disponível, o sistema deve emitir um alerta e impedir a venda acima do estoque, conforme a regra que definirmos.

O objetivo é garantir que o saldo dos lotes esteja sempre atualizado e evitar que sejam registrados pedidos com quantidades superiores às que realmente temos disponíveis em estoque