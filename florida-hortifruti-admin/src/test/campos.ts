import { fireEvent, screen, within } from '@testing-library/react'

type Campo = HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement

/** Campo do formulário pelo texto do rótulo (os rótulos do painel não usam htmlFor) */
export function campo(rotulo: string | RegExp, dentro?: HTMLElement): Campo {
  const busca = dentro ? within(dentro) : screen
  const label = busca.getAllByText(rotulo, { selector: 'label, span' })[0]
  const alvo =
    label.querySelector('input, select, textarea') ??
    label.parentElement!.querySelector('input, select, textarea')
  if (!alvo) throw new Error(`Campo sem input: ${String(rotulo)}`)
  return alvo as Campo
}

export function preencher(rotulo: string | RegExp, valor: string, dentro?: HTMLElement) {
  fireEvent.change(campo(rotulo, dentro), { target: { value: valor } })
}

/** Janela (Modal) aberta pelo título */
export function janela(titulo: string | RegExp): HTMLElement {
  const h2 = screen.getByText(titulo, { selector: 'h2' })
  return h2.parentElement!.parentElement as HTMLElement
}
