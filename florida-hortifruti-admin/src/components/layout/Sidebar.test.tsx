import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api } from '../../lib/api'
import { apiFalsa } from '../../test/api-falsa'
import { apiCompleta, pedido } from '../../test/dados'
import { logar, renderTela, USUARIO } from '../../test/render'
import { Sidebar } from './Sidebar'
import { Input, MoneyInput } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Menu lateral', () => {
  it('administrador vê tudo e o contador de pedidos novos', async () => {
    logar()
    localStorage.setItem('admin-menu-pedidos-vistos-em', 'abc')
    fake.quando('GET /pedidos', [
      pedido({
        criadoEm: undefined,
        data: undefined,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      pedido({ criadoEm: 'lixo' }),
      pedido({ criadoEm: undefined, data: undefined }),
      null,
    ])
    const fechar = vi.fn()
    renderTela(<Sidebar open onClose={fechar} />, { rota: '/estoque' })
    expect(await screen.findByLabelText('1 pedidos novos aguardando aprovação')).toBeTruthy()
    expect(fake.feitas('GET', '/pedidos')[0].params).toEqual({ status: 'AGUARDANDO_APROVACAO' })
    expect(screen.getByText('Usuários')).toBeTruthy()
    expect(screen.queryByText('Minhas entregas')).toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    expect(fechar).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }))
    expect(fechar).toHaveBeenCalledTimes(2)

    // abrir Pedidos marca tudo como visto
    fireEvent.click(screen.getByRole('link', { name: /Pedidos/ }))
    await waitFor(() => expect(screen.queryByLabelText(/pedidos novos/)).toBeNull())
    expect(Number(localStorage.getItem('admin-menu-pedidos-vistos-em'))).toBeGreaterThan(0)
    expect(screen.getByTestId('rota').textContent).toBe('/pedidos')
  })

  it('supervisor vê as telas dele e o app de entregas', async () => {
    logar({ ...USUARIO, papel: 'SUPERVISOR' })
    fake.quando('GET /pedidos', { nada: 1 })
    renderTela(<Sidebar open={false} onClose={() => {}} />)
    expect(await screen.findByText('Minhas entregas')).toBeTruthy()
    expect(screen.queryByText('Usuários')).toBeNull()
    expect(screen.queryByText('Produtos')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('administrativo vê as telas financeiras; vendedor não', async () => {
    logar({ ...USUARIO, papel: 'ADMINISTRATIVO' })
    renderTela(<Sidebar open={false} onClose={() => {}} />)
    expect(screen.getByText('Investimentos')).toBeTruthy()
    cleanup()
    logar({ ...USUARIO, papel: 'VENDEDOR' })
    renderTela(<Sidebar open={false} onClose={() => {}} />)
    expect(screen.queryByText('Investimentos')).toBeNull()
    expect(screen.getByText('Produtos')).toBeTruthy()
  })

  it('visão geral não busca pedidos e sai', async () => {
    logar({ ...USUARIO, papel: 'VISAO_GERAL' })
    renderTela(<Sidebar open={false} onClose={() => {}} />)
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(fake.feitas('GET', '/pedidos')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }))
    await waitFor(() => expect(localStorage.length).toBe(0))
  })
})

describe('Componentes de formulário', () => {
  it('senha com mostrar/ocultar, erro e valor em reais', () => {
    const mudou = vi.fn()
    render(
      <>
        <Input label="Senha" type="password" error="Obrigatória" />
        <MoneyInput label="Valor" value="" onValueChange={mudou} />
        <MoneyInput value={12.5} onValueChange={mudou} />
        <MoneyInput value={0} onValueChange={mudou} />
      </>,
    )
    expect(screen.getByText('Obrigatória')).toBeTruthy()
    const senha = document.querySelector('input[type=password]')!
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha.getAttribute('type')).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(senha.getAttribute('type')).toBe('password')
    const [vazio, cheio, zero] = screen.getAllByPlaceholderText('0,00') as HTMLInputElement[]
    expect(vazio.value).toBe('')
    expect(cheio.value).toBe('12,50')
    expect(zero.value).toBe('0,00')
    fireEvent.change(vazio, { target: { value: '1234' } })
    expect(mudou).toHaveBeenCalledWith(12.34)
  })

  it('janela fecha pelo fundo só quando permitido; botões variam', () => {
    const fechar = vi.fn()
    const { container, rerender } = render(
      <Modal open onClose={fechar} title="A" size="sm">
        <Button variant="danger" size="sm">
          x
        </Button>
        <Button variant="secondary">y</Button>
        <Button variant="ghost">z</Button>
      </Modal>,
    )
    fireEvent.click(container.querySelector('.bg-black\\/40')!)
    expect(fechar).toHaveBeenCalledTimes(1)
    rerender(
      <Modal open onClose={fechar} title="A" closeOnBackdropClick={false}>
        <p>b</p>
      </Modal>,
    )
    fireEvent.click(container.querySelector('.bg-black\\/40')!)
    expect(fechar).toHaveBeenCalledTimes(1)
    rerender(
      <Modal open={false} onClose={fechar} title="A">
        <p>b</p>
      </Modal>,
    )
    expect(screen.queryByText('A')).toBeNull()
  })
})
