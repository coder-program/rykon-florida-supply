import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl ${widths[size]}`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5">
          <h2 className="pr-3 text-sm font-semibold text-gray-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  )
}
