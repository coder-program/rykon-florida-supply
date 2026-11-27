import { useEffect, useMemo, useState } from 'react'

export const POR_PAGINA = 25

/** Fatia a lista em páginas */
export function usePaginado<T>(lista: T[], porPagina = POR_PAGINA) {
  const [pagina, setPagina] = useState(1)
  // Filtro/busca mudou o tamanho da lista: volta para a 1ª página
  useEffect(() => setPagina(1), [lista.length])
  const itens = useMemo(
    () => lista.slice((pagina - 1) * porPagina, pagina * porPagina),
    [lista, pagina, porPagina],
  )
  return { itens, pagina, setPagina, total: lista.length, porPagina }
}
