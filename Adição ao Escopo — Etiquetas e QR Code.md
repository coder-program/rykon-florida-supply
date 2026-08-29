34. GERAÇÃO E IMPRESSÃO DE ETIQUETAS
O sistema deverá possuir uma funcionalidade para geração automática de etiquetas vinculadas aos pedidos.
A etiqueta deverá ser gerada a partir das informações cadastradas no pedido, evitando a necessidade de digitação manual das informações.
34.1 Informações da etiqueta
A etiqueta deverá conter, inicialmente:
Informações da empresa
    • Nome: Flórida Hortifruti;
    • CNPJ;
    • Telefone/WhatsApp, se aplicável.
Informações do pedido
    • Número do pedido;
    • Data do pedido;
    • Nome do vendedor;
    • Status do pedido.
Informações do cliente
    • Nome/Razão Social;
    • Nome do estabelecimento, quando aplicável;
    • Endereço de entrega;
    • Cidade/UF;
    • Telefone, se necessário.
Informações dos produtos
    • Produto;
    • Quantidade;
    • Unidade de venda.
Exemplo:
PEDIDO Nº 000123
CLIENTE: Coco Bambu Alphaville
ENTREGA:
Endereço do cliente
PRODUTOS:
B2 — 30 caixas
B3 — 20 caixas
VENDEDOR: César

34.2 QR CODE
Cada etiqueta deverá possuir um QR Code exclusivo vinculado ao respectivo pedido.
O QR Code deverá direcionar para uma página do sistema referente àquele pedido.
Ao realizar a leitura do QR Code, deverão ser exibidas informações como:
    • Número do pedido;
    • Cliente;
    • Data;
    • Vendedor;
    • Produtos;
    • Quantidades;
    • Status do pedido;
    • Informações de entrega.
As informações financeiras poderão ser ocultadas da página pública do QR Code, conforme definição da empresa.

34.3 Identificação única
Cada pedido deverá possuir um identificador único.
Exemplo:
Pedido nº 000123
O QR Code deverá estar vinculado exclusivamente a esse pedido.
Caso o pedido seja atualizado, as informações acessadas pelo QR Code deverão refletir o status/informações atualizadas no sistema.

34.4 Impressão
O sistema deverá permitir:
    • Gerar a etiqueta;
    • Visualizar antes da impressão;
    • Imprimir individualmente;
    • Reimprimir uma etiqueta;
    • Definir o tamanho da etiqueta;
    • Configurar o layout da impressão.
A etiqueta deverá ser desenvolvida considerando uma impressora de etiquetas térmica de pequeno porte.
O desenvolvedor deverá verificar a compatibilidade com os principais modelos de impressoras térmicas disponíveis no mercado.

34.5 Vinculação da etiqueta ao pedido
A etiqueta deverá ser gerada automaticamente a partir do pedido.
Fluxo:
Pedido criado ↓ Pedido aprovado ↓ Sistema gera número do pedido ↓ Sistema gera etiqueta ↓ QR Code é vinculado ao pedido ↓ Etiqueta pode ser impressa ↓ Etiqueta acompanha a mercadoria

34.6 Possibilidade futura — rastreabilidade da entrega
O sistema deverá ser estruturado de forma que futuramente o QR Code possa ser utilizado para registrar etapas do pedido.
Exemplo:
Pedido criado → Separado → Saiu para entrega → Entregue
Futuramente poderá ser possível registrar:
    • Data e horário da entrega;
    • Responsável pela entrega;
    • Pessoa que recebeu;
    • Observação;
    • Comprovante/foto;
    • Assinatura digital.
Essa funcionalidade poderá ser desenvolvida em uma segunda etapa.