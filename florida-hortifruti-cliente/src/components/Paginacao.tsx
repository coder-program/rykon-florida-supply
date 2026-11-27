import { ChevronLeft, ChevronRight } from 'lucide-react'
import { POR_PAGINA } from '../lib/usePaginado'

export function Paginacao({
  pagina,
  total,
  porPagina = POR_PAGINA,
  onChange,
}: {
  pagina: number
  total: number
  porPagina?: number
  onChange: (pagina: number) => void
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  if (total <= porPagina) return null
  const inicio = (pagina - 1) * porPagina + 1
  const fim = Math.min(total, pagina * porPagina)
  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600"
    >
      <span>
        {inicio}–{fim} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
          className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-16 text-center">
          {pagina} / {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => onChange(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Próxima página"
          className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
