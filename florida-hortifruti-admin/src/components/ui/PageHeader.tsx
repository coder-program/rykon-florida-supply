import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6 md:py-5">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  )
}
