-- Revendedor que também é motorista (ex.: Hugo)
ALTER TABLE "usuarios" ADD COLUMN "tambemMotorista" BOOLEAN NOT NULL DEFAULT false;

-- Venda do revendedor abaixo do preço sugerido: aguarda autorização do administrador
ALTER TABLE "pedidos" ADD COLUMN "aguardandoAutorizacaoPreco" BOOLEAN NOT NULL DEFAULT false;

-- Pagamento da compra ao fornecedor (relatório de compras); nulo = pendente
ALTER TABLE "compras_estoque" ADD COLUMN "dataPagamento" TIMESTAMP(3);
