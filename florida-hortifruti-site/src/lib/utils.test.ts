import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('junta classes e a última do Tailwind vence', () => {
    expect(cn('px-2', false && 'hidden', 'px-4')).toBe('px-4')
  })
})
