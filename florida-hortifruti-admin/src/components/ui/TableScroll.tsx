import type { ReactNode } from 'react'

export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[640px] overflow-hidden rounded-xl border border-gray-200 bg-white">
        {children}
      </div>
    </div>
  )
}
