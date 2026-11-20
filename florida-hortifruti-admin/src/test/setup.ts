import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy/waitFor esperam 1 s por padrão: pouco quando a máquina está carregada
configure({ asyncUtilTimeout: 15_000 })

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
