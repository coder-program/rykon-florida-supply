const KEY = 'portal_carrinho'

export type CartItem = {
  produtoId: string
  nome: string
  unidadeVenda: string
  preco: number | null
  quantidade: number
}

export function lerCarrinho(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function salvarCarrinho(itens: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(itens))
}

export function totalItens(itens: CartItem[]) {
  return itens.reduce((acc, i) => acc + i.quantidade, 0)
}

export function subtotal(itens: CartItem[]) {
  return itens.reduce((acc, i) => acc + (i.preco ?? 0) * i.quantidade, 0)
}
