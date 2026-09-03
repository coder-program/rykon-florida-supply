import type { ReactNode } from 'react'

export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
      {children}
    </div>
  )
}
