import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { hojeISO } from '../lib/utils'
import { InvestimentosPage } from './InvestimentosPage'

const IV1 = {
  id: 'iv1',
  nome: 'Marcelo',
  data: '2026-11-10T15:00:00Z',
  valor: 1000,
  motivo: 'caminhão',
  valorDevolvido: 400,
  valorRestante: 600,
  status: 'PARCIAL',
  devolvidoEm: null,
  devolucoes: [{ id: 'dv1', valor: 400, data: '2026-11-12T15:00:00Z', observacao: 'pix' }],
}

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const nomes = () =>
  screen.queryAllByText(/^(Marcelo|Duda)$/, { selector: 'td' }).map((t) => t.textContent)

describe('Investimentos', () => {
  it('totais, busca e filtros', async () => {
    renderTela(<InvestimentosPage />)
    await waitFor(() => expect(nomes()).toEqual(['Marcelo', 'Marcelo', 'Duda']))
    expect(screen.getByText(/R\$\s1\.250,00/)).toBeTruthy()
    expect(screen.getAllByText(/R\$\s400,00 · falta R\$\s600,00/)).toHaveLength(2)
    expect(screen.getAllByText(/^Em \d/).length).toBe(1)
    expect(screen.getByText(/Devolvido R\$\s200,00 em/)).toBeTruthy()
    expect(screen.getAllByText('—').length).toBe(1)

    fireEvent.change(screen.getByPlaceholderText('Nome ou motivo'), {
      target: { value: ' BALANÇA ' },
    })
    expect(nomes()).toEqual(['Marcelo'])
    fireEvent.change(screen.getByPlaceholderText('Nome ou motivo'), { target: { value: 'duda' } })
    expect(nomes()).toEqual(['Duda'])
    fireEvent.change(screen.getByPlaceholderText('Nome ou motivo'), { target: { value: 'xyz' } })
    expect(screen.getAllByText('Nenhum aporte encontrado')).toHaveLength(2)
    fireEvent.change(screen.getByPlaceholderText('Nome ou motivo'), { target: { value: '' } })
    preencher('Status', 'ABERTOS')
    expect(nomes()).toEqual(['Marcelo', 'Duda'])
    preencher('Status', 'DEVOLVIDO')
    expect(nomes()).toEqual(['Marcelo'])
    preencher('Status', 'FALTA_DEVOLVER')
    expect(nomes()).toEqual(['Duda'])
  })

  it('novo aporte, editar, erros e excluir', async () => {
    fake.quando('POST /investimentos', new ErroApi(400, ['nome curto', 'valor alto']))
    fake.quando('PUT /investimentos/:id', {})
    fake.quando('DELETE /investimentos/:id', {})
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    renderTela(<InvestimentosPage />)
    await waitFor(() => expect(nomes()).toHaveLength(3))

    fireEvent.click(screen.getByRole('button', { name: /Novo aporte/ }))
    let modal = janela('Novo aporte')
    const salvar = within(modal).getByRole('button', { name: 'Salvar' }) as HTMLButtonElement
    expect(salvar.disabled).toBe(true)
    expect(campo('Data *', modal).value).toBe(hojeISO())
    preencher('Nome (quem fez o aporte) *', 'Cesar', modal)
    preencher('Valor (R$) *', '', modal)
    preencher('Valor (R$) *', '30000', modal)
    preencher('Motivo *', 'balança nova', modal)
    preencher('Data *', '2026-11-01', modal)
    fireEvent.click(salvar)
    expect(await within(modal).findByText('nome curto valor alto')).toBeTruthy()
    fake.quando('POST /investimentos', new ErroApi(500, null))
    fireEvent.click(salvar)
    expect(await within(modal).findByText('Não foi possível salvar o aporte.')).toBeTruthy()
    fake.quando('POST /investimentos', {})
    fireEvent.click(salvar)
    await waitFor(() => expect(screen.queryByText('Novo aporte', { selector: 'h2' })).toBeNull())
    expect(fake.feitas('POST', '/investimentos').at(-1)?.data).toEqual({
      nome: 'Cesar',
      data: '2026-11-01',
      valor: 300,
      motivo: 'balança nova',
    })

    fireEvent.click(screen.getAllByTitle('Editar')[0])
    modal = janela('Editar aporte')
    expect(campo('Nome (quem fez o aporte) *', modal).value).toBe('Marcelo')
    expect(campo('Valor (R$) *', modal).value).toBe('1.000,00')
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getAllByTitle('Editar')[0])
    preencher('Motivo *', 'caminhão baú', janela('Editar aporte'))
    fireEvent.click(within(janela('Editar aporte')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fake.feitas('PUT', '/investimentos/iv1')[0]?.data).toMatchObject({
        motivo: 'caminhão baú',
        valor: 1000,
      }),
    )

    fireEvent.click(screen.getAllByTitle('Excluir')[0])
    expect(fake.feitas('DELETE', '/investimentos/iv1')).toHaveLength(0)
    fireEvent.click(screen.getAllByTitle('Excluir')[0])
    await waitFor(() => expect(fake.feitas('DELETE', '/investimentos/iv1')).toHaveLength(1))
    expect(confirmar).toHaveBeenCalledTimes(2)
  })

  it('devoluções: registrar, validar, erro e excluir', async () => {
    const quitado = {
      ...IV1,
      valorDevolvido: 1000,
      valorRestante: 0,
      status: 'DEVOLVIDO',
      devolvidoEm: '2026-11-18T15:00:00Z',
      devolucoes: [
        ...IV1.devolucoes,
        { id: 'dv9', valor: 600, data: '2026-11-18T15:00:00Z', observacao: null },
      ],
    }
    fake.quando('POST /investimentos/:id/devolucoes', quitado)
    fake.quando('DELETE /investimentos/:id/devolucoes/:dev', {
      ...IV1,
      devolucoes: [],
      valorDevolvido: 0,
      valorRestante: 1000,
      status: 'FALTA_DEVOLVER',
    })
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    renderTela(<InvestimentosPage />)
    await waitFor(() => expect(nomes()).toHaveLength(3))

    fireEvent.click(screen.getAllByTitle('Devoluções')[0])
    let modal = janela('Devoluções — Marcelo')
    expect(within(modal).getByText('pix')).toBeTruthy()
    expect(campo('Valor devolvido (R$) *', modal).value).toBe('600,00')
    const registrar = within(modal).getByRole('button', {
      name: 'Registrar devolução',
    }) as HTMLButtonElement
    preencher('Valor devolvido (R$) *', '70000', modal)
    expect(within(modal).getByText('O valor passa do que falta devolver.')).toBeTruthy()
    expect(registrar.disabled).toBe(true)
    fireEvent.submit(registrar.closest('form')!)
    expect(fake.feitas('POST', '/investimentos/iv1/devolucoes')).toHaveLength(0)
    preencher('Valor devolvido (R$) *', '', modal)
    expect(registrar.disabled).toBe(true)
    preencher('Valor devolvido (R$) *', '60000', modal)
    preencher('Data da devolução *', '2026-11-18', modal)
    preencher('Observação', 'transferência', modal)
    fake.quando('POST /investimentos/:id/devolucoes', new ErroApi(400))
    fireEvent.click(registrar)
    expect(await within(modal).findByText('Erro')).toBeTruthy()
    fake.quando('POST /investimentos/:id/devolucoes', new ErroApi(500, null))
    fireEvent.click(registrar)
    expect(await within(modal).findByText('Não foi possível registrar.')).toBeTruthy()
    fake.quando('POST /investimentos/:id/devolucoes', quitado)
    fireEvent.click(registrar)
    await waitFor(() =>
      expect(within(janela('Devoluções — Marcelo')).queryByText('Registrar devolução')).toBeNull(),
    )
    expect(fake.feitas('POST', '/investimentos/iv1/devolucoes').at(-1)?.data).toEqual({
      valor: 600,
      data: '2026-11-18',
      observacao: 'transferência',
    })

    modal = janela('Devoluções — Marcelo')
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Excluir devolução' })[0])
    expect(fake.feitas('DELETE', '/investimentos/iv1/devolucoes/dv1')).toHaveLength(0)
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Excluir devolução' })[0])
    expect(
      await within(janela('Devoluções — Marcelo')).findByText(
        'Nenhuma devolução registrada ainda.',
      ),
    ).toBeTruthy()
    fireEvent.click(within(janela('Devoluções — Marcelo')).getByRole('button', { name: 'Fechar' }))

    // Resposta de outro aporte não troca o que está aberto
    fake.quando('POST /investimentos/:id/devolucoes', { ...IV1, id: 'outro', valorRestante: 5 })
    fireEvent.click(screen.getAllByTitle('Devoluções').at(-1)!)
    modal = janela('Devoluções — Duda')
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar devolução' }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/investimentos/iv3/devolucoes')).toHaveLength(1),
    )
    expect(janela('Devoluções — Duda')).toBeTruthy()
    await waitFor(() =>
      expect(campo('Valor devolvido (R$) *', janela('Devoluções — Duda')).value).toBe('5,00'),
    )
  })

  it('lista vazia', async () => {
    fake.quando('GET /investimentos', [])
    renderTela(<InvestimentosPage />)
    expect((await screen.findAllByText('Nenhum aporte encontrado')).length).toBe(2)
  })
})
