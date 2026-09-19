// Seção 25 do escopo: salvar rascunho automaticamente para nunca perder dados
const KEY = 'pedido_rascunho'

export function salvarRascunho(dados: unknown) {
  try { localStorage.setItem(KEY, JSON.stringify(dados)) } catch {}
}

export function carregarRascunho<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function limparRascunho() {
  localStorage.removeItem(KEY)
}
