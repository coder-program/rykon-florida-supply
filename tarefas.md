Prompt final

"Precisamos das seguintes melhorias no sistema Flórida Hortifruti, envolvendo etiqueta/lote, portal do cliente e um dashboard geral com status automático:

1. Etiqueta com data de embalagem e número do lote

O model Etiqueta (schema.prisma) hoje só guarda tokenPublico, ocultarValores, geradaEm e reimpressoes. Adicionar dataEmbalagem (DateTime, preenchida no momento da geração/impressão) e vincular o(s) numeroLote usado(s) no pedido.
Como um pedido pode ter itens de lotes diferentes (já existe ItemPedidoLote ligando item do pedido ao LoteProduto.numero), a etiqueta deve listar o(s) lote(s) por produto — não um campo único de lote no cabeçalho.
Atualizar EtiquetasService.buscarCompleto() para incluir esses dados no retorno, e o template de impressão (PDF/HTML da etiqueta) para exibir "Data de embalagem" e "Lote" ao lado de cada produto.
Definir: se não houver lote vinculado ao item (produto sem controle de lote), o campo deve ficar em branco ou omitido — não quebrar a geração.
2. Acompanhamento de rota no portal do cliente

Hoje o app florida-hortifruti-cliente (PedidoDetalhePage.tsx) mostra dados do pedido mas não uma timeline de status/entrega.
Adicionar uma seção de acompanhamento baseada no StatusPedido já existente (AGUARDANDO_APROVACAO → APROVADO → EM_SEPARACAO → PRONTO_PARA_ENTREGA → EM_ENTREGA → ENTREGUE), exibida como linha do tempo (ex.: "Pedido aprovado", "Em separação", "A caminho", "Entregue"), com data/hora de cada mudança.
Isso exige registrar o histórico de transição de status do pedido (hoje o Pedido só guarda o status atual) — criar tabela HistoricoStatusPedido (pedidoId, status, alteradoEm) ou reaproveitar padrão parecido com HistoricoPreco.
Definir: o cliente vê apenas status/timeline, sem posição GPS em tempo real do motorista (a menos que isso seja pedido explicitamente depois — não está no escopo desta mensagem).
3. Dashboard geral + status automático por ação

Criar uma tela de dashboard (provavelmente no florida-hortifruti-admin) com indicadores: quantidade de vendas (por período), estoque (saldo por produto/lote, puxando de LoteProduto/MovimentacaoEstoqueLote), e status dos pedidos em aberto (contagem por StatusPedido).
Regra de automação 1: quando o vendedor imprimir a etiqueta, o pedido deve passar automaticamente para EM_SEPARACAO. Isso já existe parcialmente em EtiquetasService.garantirParaPedido() (muda de APROVADO para EM_SEPARACAO na primeira geração) — validar que toda impressão (inclusive reimpressão) reflita esse status corretamente e que o dashboard mostre isso em tempo real.
Regra de automação 2: quando o motorista escanear o QR Code da etiqueta pela câmera do celular, o pedido deve mudar para EM_ENTREGA ("a caminho"). Hoje o app florida-hortifruti-motorista não tem leitor de câmera/QR — precisa:
Adicionar biblioteca de leitura de QR via câmera (ex. @zxing/browser ou BarcodeDetector nativo) no PWA do motorista.
Criar endpoint no backend (ex. POST /motorista/entregas/:pedidoId/scan ou reaproveitar o tokenPublico da etiqueta) que valida o token escaneado, confirma que o pedido pertence à rota do motorista logado, e transiciona o status para EM_ENTREGA.
Deve ser idempotente (escanear de novo não deve quebrar nada) e só permitir a transição a partir de PRONTO_PARA_ENTREGA (ou EM_SEPARACAO, a definir a regra exata de onde a leitura é permitida).
Observação: os três itens dependem de status/lote que já existem parcialmente no sistema (StatusPedido, LoteProduto, Etiqueta) — o trabalho principal é (a) estender o schema com os campos que faltam, (b) registrar histórico de status para dar suporte à timeline do cliente, e (c) fechar o ciclo etiqueta → separação → scan do motorista → a caminho, hoje só parcialmente automatizado."