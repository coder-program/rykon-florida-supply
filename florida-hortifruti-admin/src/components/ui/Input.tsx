import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn, formatBRLInput, parseBRLInput } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, type, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          className={cn(
            'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
            isPassword && 'pr-10',
            error && 'border-red-400',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function MoneyInput({
  label,
  value,
  onValueChange,
  required,
  placeholder = '0,00',
}: {
  label?: string
  value: number | string
  onValueChange: (value: number) => void
  required?: boolean
  placeholder?: string
}) {
  const display = value === '' || value === undefined || value === null || value === 0
    ? (value === 0 ? '0,00' : '')
    : formatBRLInput(value)

  return (
    <Input
      label={label}
      inputMode="numeric"
      placeholder={placeholder}
      required={required}
      value={value === '' || value === undefined || value === null ? '' : display}
      onChange={(e) => onValueChange(parseBRLInput(e.target.value))}
    />
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
