import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

// APIs do navegador que o jsdom não tem
class ObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.IntersectionObserver ??= ObserverFalso as never
globalThis.ResizeObserver ??= ObserverFalso as never
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as never
window.scrollTo = (() => {}) as never
Element.prototype.scrollIntoView ??= () => {}
URL.createObjectURL ??= () => 'blob:teste'
URL.revokeObjectURL ??= () => {}
