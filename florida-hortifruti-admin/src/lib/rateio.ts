// Mesmo rateio do backend (EstoqueService.calcularRateio): frete e comissão divididos
// proporcionalmente ao valor de cada item; o último item recebe a sobra dos centavos
export type ItemRateio = { produtoId: string; quantidade: string | number; valorProduto: number }

export function toCents(value: number) {
  return Math.round(Number(value || 0) * 100)
}

export function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2))
}

export function previewRateio(itens: ItemRateio[], valorFrete: number, valorComissao: number) {
  const validos = itens.filter((item) => item.produtoId && Number(item.quantidade) > 0)
  if (validos.length === 0) return []

  const freteCents = toCents(valorFrete)
  const comissaoCents = toCents(valorComissao)
  const valoresCents = validos.map((item) =>
    toCents(Number(item.quantidade || 0) * Number(item.valorProduto || 0)),
  )
  const totalCents = valoresCents.reduce((acc, value) => acc + value, 0)
  let usadoFrete = 0
  let usadoComissao = 0

  return validos.map((item, index) => {
    const ultimo = index === validos.length - 1
    const peso = totalCents > 0 ? valoresCents[index] / totalCents : 1 / validos.length
    const rateioFreteCents = ultimo ? freteCents - usadoFrete : Math.round(freteCents * peso)
    const rateioComissaoCents = ultimo
      ? comissaoCents - usadoComissao
      : Math.round(comissaoCents * peso)
    usadoFrete += rateioFreteCents
    usadoComissao += rateioComissaoCents
    const valorProduto = fromCents(valoresCents[index])
    const rateioFrete = fromCents(rateioFreteCents)
    const rateioComissao = fromCents(rateioComissaoCents)
    const custoTotal = Number((valorProduto + rateioFrete + rateioComissao).toFixed(2))
    const quantidade = Number(item.quantidade)
    return {
      produtoId: item.produtoId,
      quantidade,
      valorUnitario: Number(item.valorProduto || 0),
      valorProduto,
      rateioFrete,
      rateioComissao,
      custoTotal,
      custoCaixa: quantidade > 0 ? Number((custoTotal / quantidade).toFixed(4)) : 0,
    }
  })
}
