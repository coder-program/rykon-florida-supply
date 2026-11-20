import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { janela } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { SolicitacoesAlteracaoPage } from './SolicitacoesAlteracaoPage'
import { EtiquetaPage } from './EtiquetaPage'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Solicitações de alteração', () => {
  it('aprova com etiquetas extras e nega com motivo', async () => {
    fake.quando('POST /solicitacoes-alteracao/:id/aprovar', {
      etiquetasExtras: { de: 5, ate: 6 },
      etiquetaId: 'et1',
    })
    fake.quando('POST /solicitacoes-alteracao/:id/negar', {})
    renderTela(<SolicitacoesAlteracaoPage />)
    expect(await screen.findByText(/Morango B3 \(10\/11 - lote 7\): 4 → 6 cx/)).toBeTruthy()
    expect(screen.getByText(/cliente pediu/)).toBeTruthy()
    expect(screen.getByText('Resposta: não dá')).toBeTruthy()
    expect(screen.getByText('-2 cx')).toBeTruthy()
    expect(screen.getAllByText('+2 cx').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: /Negar/ })[0])
    const modal = janela('Negar solicitação')
    fireEvent.click(within(modal).getByRole('button', { name: 'Voltar' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Negar/ })[0])
    fireEvent.change(screen.getByPlaceholderText('Motivo (opcional)'), {
      target: { value: ' sem estoque ' },
    })
    fireEvent.click(within(janela('Negar solicitação')).getByRole('button', { name: 'Negar' }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/solicitacoes-alteracao/s1/negar')[0]?.data).toEqual({
        resposta: 'sem estoque',
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Negar/ })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Negar/ })[0])
    fireEvent.click(within(janela('Negar solicitação')).getByRole('button', { name: 'Negar' }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/solicitacoes-alteracao/s1/negar')[1]?.data).toEqual({}),
    )

    fireEvent.click(screen.getAllByRole('button', { name: /Aprovar/ })[0])
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/etiqueta/et1'))
  })

  it('aprovação sem etiquetas extras, reimpressão e filtros', async () => {
    fake.quando('POST /solicitacoes-alteracao/:id/aprovar', {})
    renderTela(<SolicitacoesAlteracaoPage />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Aprovar/ }))[0])
    await waitFor(() =>
      expect(fake.feitas('POST', '/solicitacoes-alteracao/s1/aprovar')).toHaveLength(1),
    )
    expect(screen.getByTestId('rota').textContent).toBe('/')

    fireEvent.click(screen.getByRole('button', { name: /Imprimir Caixa 05 a Caixa 05/ }))
    expect(screen.getByTestId('rota').textContent).toBe('/etiqueta/et1')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    await waitFor(() => expect(fake.chamadas.at(-1)?.params).toEqual({}))
  })

  it('lista vazia', async () => {
    fake.quando('GET /solicitacoes-alteracao', [])
    renderTela(<SolicitacoesAlteracaoPage />)
    expect(await screen.findByText(/Nenhuma solicitação/)).toBeTruthy()
  })
})

describe('Etiqueta', () => {
  const abrir = (rota = '/etiqueta/et1') =>
    renderTela(<EtiquetaPage />, { rota, caminho: '/etiqueta/:id' })

  it('uma via por caixa e impressão', async () => {
    fake.quando('POST /etiquetas/:id/reimprimir', {})
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    abrir()
    expect(await screen.findByText(/3 etiquetas — Pedido #000181/)).toBeTruthy()
    expect(screen.getAllByText('Caixa 03').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/LOTE: 7/).length).toBe(3)
    expect(screen.getByText(/1 reimpressão/)).toBeTruthy()
    expect(document.title).toContain('3 etiquetas #000181')
    fireEvent.click(screen.getByRole('button', { name: /Imprimir 3 etiquetas/ }))
    expect(imprimir).toHaveBeenCalled()
    await waitFor(() => expect(fake.feitas('POST', '/etiquetas/et1/reimprimir')).toHaveLength(1))
  })

  it('intervalo de caixas, status e etiqueta sem dados', async () => {
    abrir('/etiqueta/et1?de=2&ate=9')
    expect((await screen.findAllByText(/2 etiquetas/)).length).toBeGreaterThan(0)
    cleanup()
    for (const [status, texto] of [
      ['EM_ENTREGA', 'A caminho'],
      ['EM_SEPARACAO', 'Pedido em Andamento'],
      ['PRONTO_PARA_ENTREGA', 'Pronto para entrega'],
      ['ENTREGUE', 'Entregue'],
      ['OUTRO', 'OUTRO'],
    ]) {
      fake.quando('GET /etiquetas/:id', {
        pedido: { numero: 1, status },
        cliente: { razaoSocialOuNome: 'X', endereco: null, cidade: null, estado: null },
        reimpressoes: 0,
        dataEmbalagem: null,
        qrCodeDataUrl: null,
        totalCaixas: 0,
        itens: status === 'OUTRO' ? undefined : [{ quantidade: 2 }],
      })
      abrir('/etiqueta/x?de=0&ate=0')
      expect(
        (await screen.findAllByText(`STATUS: ${texto}`, { exact: false })).length,
      ).toBeGreaterThan(0)
      expect(screen.getAllByText('Endereço não informado').length).toBeGreaterThan(0)
      cleanup()
    }
    fake.quando('GET /etiquetas/:id', {
      pedido: { numero: 1, status: 'APROVADO' },
      cliente: { razaoSocialOuNome: 'X', cidade: 'Barueri' },
      reimpressoes: 0,
      dataEmbalagem: null,
      totalCaixas: 1,
      itens: [{ lotes: ['9'] }],
    })
    abrir()
    expect(await screen.findByText(/LOTE: 9/)).toBeTruthy()
    expect(screen.getByText('Barueri')).toBeTruthy()
  })

  it('etiqueta não encontrada', async () => {
    fake.quando('GET /etiquetas/:id', new ErroApi(404))
    abrir()
    expect(await screen.findByText(/não encontrada|Não foi possível/i)).toBeTruthy()
  })
})
