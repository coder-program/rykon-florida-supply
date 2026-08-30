import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
      <input
        className={cn(
          'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
          error && 'border-red-400',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Select({ label, children, className, ...props }: { label?: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
      <select
        className={cn(
          'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white',
          'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
