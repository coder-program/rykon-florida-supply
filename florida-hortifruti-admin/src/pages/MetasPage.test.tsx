import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { MetasPage } from './MetasPage'

const dia = (data: string, extra: object = {}) => ({
  data,
  lucro: 0,
  temMeta: true,
  motivo: null,
  base: 500,
  acumulado: 0,
  meta: 500,
  falta: 0,
  atingida: false,
  emAndamento: false,
  abatimento: 0,
  marcadaBatida: false,
  motivoAbatimento: null,
  ...extra,
})

const HOJE = dia('2026-11-18', {
  percentual: 60,
  lucro: 300,
  meta: 700,
  acumulado: 200,
  falta: 400,
  emAndamento: true,
})

const MES = {
  mes: '2026-11',
  hoje: '2026-11-18',
  dias: [
    dia('2026-11-13', { temMeta: false, motivoSemMeta: 'SEM_VALOR' }),
    dia('2026-11-14', { temMeta: false, motivoSemMeta: 'SEM_META', motivo: 'feriado', lucro: 50 }),
    dia('2026-11-15', { temMeta: false, motivoSemMeta: 'DOMINGO' }),
    dia('2026-11-16', { lucro: 600, atingida: true }),
    dia('2026-11-17', { lucro: 200, falta: 300 }),
    dia('2026-11-12', {
      lucro: 500,
      atingida: true,
      marcadaBatida: true,
      motivoAbatimento: 'aporte',
    }),
    dia('2026-11-11', {
      lucro: 400,
      falta: 0,
      abatimento: 100,
      atingida: true,
      motivoAbatimento: 'chuva',
    }),
    { ...HOJE },
  ],
  resumo: { diasComMeta: 5, diasAtingidos: 3, lucroTotal: 1750 },
}

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
    .quando('GET /metas/hoje', HOJE)
    .quando('GET /metas/mes', MES)
    .quando('GET /metas/valores', [
      { id: 'mv1', valor: 500, vigenteDesde: '2026-11-01' },
      { id: 'mv0', valor: 400, vigenteDesde: '2026-10-01' },
    ])
    .quando('GET /metas/dias-sem-meta', [
      { data: '2026-11-14', motivo: 'feriado' },
      { data: '2026-11-20', motivo: null },
    ])
    .quando('POST /metas/valores', {})
    .quando('DELETE /metas/valores/:id', {})
    .quando('POST /metas/dias-sem-meta', {})
    .quando('DELETE /metas/dias-sem-meta/:data', {})
    .quando('POST /metas/abatimentos', {})
    .quando('DELETE /metas/abatimentos/:data', {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Metas', () => {
  it('meta de hoje, valor, dias sem meta e histórico', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    renderTela(<MetasPage />)
    expect(await screen.findByText(/R\$\s200,00 que faltou antes/)).toBeTruthy()
    expect(screen.getByText('· 18/11/2026')).toBeTruthy()
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getAllByText(/R\$\s400,00/).length).toBeGreaterThan(0)
    expect(screen.getByText('atual')).toBeTruthy()
    expect(await screen.findByText('Meta batida em 3 de 5 dias')).toBeTruthy()

    // valor da meta: hoje, depois retroativo (cancelado e confirmado), depois erro
    const salvar = screen.getByRole('button', { name: 'Salvar meta' }) as HTMLButtonElement
    expect(salvar.disabled).toBe(true)
    preencher('Meta de lucro por dia (R$)', '55000')
    fireEvent.click(salvar)
    await waitFor(() =>
      expect(fake.feitas('POST', '/metas/valores')[0]?.data).toEqual({
        valor: 550,
        vigenteDesde: '2026-11-18',
      }),
    )
    await waitFor(() => expect(campo('Meta de lucro por dia (R$)').value).toBe(''))
    preencher('Meta de lucro por dia (R$)', '60000')
    preencher('Vale a partir de', '2026-11-01')
    expect(screen.getByText(/Data no passado/)).toBeTruthy()
    fireEvent.click(salvar)
    expect(fake.feitas('POST', '/metas/valores')).toHaveLength(1)
    fireEvent.click(salvar)
    await waitFor(() =>
      expect(fake.feitas('POST', '/metas/valores')[1]?.data).toEqual({
        valor: 600,
        vigenteDesde: '2026-11-01',
      }),
    )
    fake.quando('POST /metas/valores', new ErroApi(500))
    await waitFor(() => expect(campo('Meta de lucro por dia (R$)').value).toBe(''))
    preencher('Meta de lucro por dia (R$)', '100')
    fireEvent.submit(salvar.closest('form')!)
    expect(await screen.findByText(/Não foi possível salvar. Tente de novo./)).toBeTruthy()
    preencher('Meta de lucro por dia (R$)', '')
    fireEvent.submit(salvar.closest('form')!)

    // excluir valor (cancela e confirma)
    confirmar.mockReturnValueOnce(false)
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir valor' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir valor' })[0])
    await waitFor(() => expect(fake.feitas('DELETE', '/metas/valores/mv1')).toHaveLength(1))
    expect(confirmar).toHaveBeenCalled()

    // dias sem meta
    expect(screen.getByText('20/11 · sex')).toBeTruthy()
    const marcar = screen.getByRole('button', { name: /Marcar$/ })
    fireEvent.submit(marcar.closest('form')!)
    expect(fake.feitas('POST', '/metas/dias-sem-meta')).toHaveLength(0)
    preencher('Dia', '2026-11-25')
    fireEvent.click(marcar)
    await waitFor(() =>
      expect(fake.feitas('POST', '/metas/dias-sem-meta')[0]?.data).toEqual({ data: '2026-11-25' }),
    )
    preencher('Dia', '2026-11-26')
    preencher('Motivo (opcional)', ' Natal ')
    fireEvent.click(marcar)
    await waitFor(() =>
      expect(fake.feitas('POST', '/metas/dias-sem-meta')[1]?.data).toEqual({
        data: '2026-11-26',
        motivo: 'Natal',
      }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover dia sem meta' })[1])
    await waitFor(() =>
      expect(fake.feitas('DELETE', '/metas/dias-sem-meta/2026-11-20')).toHaveLength(1),
    )

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-10' } })
    await waitFor(() =>
      expect(fake.feitas('GET', '/metas/mes').at(-1)?.params).toEqual({ mes: '2026-10' }),
    )
  })

  it('tabela do mês e abatimentos', async () => {
    renderTela(<MetasPage />)
    expect(await screen.findByText(/Faltou R\$\s300,00/)).toBeTruthy()
    expect(screen.getByText('Meta não definida')).toBeTruthy()
    expect(screen.getByText('Sem meta — feriado')).toBeTruthy()
    expect(screen.getByText('Domingo')).toBeTruthy()
    expect(screen.getAllByText('Batida').length).toBe(3)
    expect(screen.getByText(/Faltam R\$\s400,00/)).toBeTruthy()
    expect(screen.getByText('hoje')).toBeTruthy()
    expect(screen.getByText(/\+R\$\s200,00 acumulado/)).toBeTruthy()
    expect(screen.getByText('Marcada como batida — aporte')).toBeTruthy()
    expect(screen.getByText(/Abatido R\$\s100,00 — chuva/)).toBeTruthy()

    // novo abatimento no dia 17 (falta 300)
    const abater = screen.getAllByRole('button', { name: 'Abater' })
    expect(abater).toHaveLength(2)
    fireEvent.click(abater[1])
    let modal = janela('Abater meta — 17/11 · ter')
    expect(within(modal).queryByRole('button', { name: 'Remover abatimento' })).toBeNull()
    expect(campo('Valor a abater (R$)', modal).value).toBe('300,00')
    fireEvent.click(within(modal).getByRole('checkbox'))
    expect(within(modal).queryByText('Valor a abater (R$)')).toBeNull()
    fireEvent.click(within(modal).getByRole('checkbox'))
    preencher('Valor a abater (R$)', '', modal)
    preencher('Motivo *', 'aporte do Marcelo', modal)
    fake.quando('POST /metas/abatimentos', new ErroApi(400, 'Valor maior que a falta'))
    fireEvent.submit(within(modal).getByRole('button', { name: 'Salvar' }).closest('form')!)
    expect(await within(modal).findByText('Valor maior que a falta')).toBeTruthy()
    fake.quando('POST /metas/abatimentos', new ErroApi(500, null))
    fireEvent.submit(within(modal).getByRole('button', { name: 'Salvar' }).closest('form')!)
    await waitFor(() => expect(fake.feitas('POST', '/metas/abatimentos')).toHaveLength(2))
    fake.quando('POST /metas/abatimentos', {})
    fireEvent.click(within(modal).getByRole('checkbox'))
    fireEvent.submit(within(modal).getByRole('button', { name: 'Salvar' }).closest('form')!)
    await waitFor(() => expect(screen.queryByText(/Abater meta —/)).toBeNull())
    expect(fake.feitas('POST', '/metas/abatimentos').map((c) => c.data)).toEqual([
      { data: '2026-11-17', batida: false, valor: 0, motivo: 'aporte do Marcelo' },
      { data: '2026-11-17', batida: false, valor: 0, motivo: 'aporte do Marcelo' },
      { data: '2026-11-17', batida: true, motivo: 'aporte do Marcelo' },
    ])

    // editar abatimentos existentes: marcado como batido e com valor
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar abatimento' })[1])
    modal = janela(/Abater meta — 12\/11/)
    expect((within(modal).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar abatimento' })[0])
    modal = janela(/Abater meta — 11\/11/)
    expect(campo('Valor a abater (R$)', modal).value).toBe('100,00')
    fireEvent.click(within(modal).getByRole('button', { name: 'Remover abatimento' }))
    await waitFor(() =>
      expect(fake.feitas('DELETE', '/metas/abatimentos/2026-11-11')).toHaveLength(1),
    )
    await waitFor(() => expect(screen.queryByText(/Abater meta —/)).toBeNull())
  })

  it('supervisor sem abatimento; meta batida e meta agendada', async () => {
    logar({ id: 'v1', nome: 'Cesar', email: 'c@x', papel: 'SUPERVISOR' })
    fake.quando('GET /metas/hoje', { ...HOJE, atingida: true, acumulado: 0, percentual: 130 })
    fake.quando('GET /metas/valores', [{ id: 'mv2', valor: 900, vigenteDesde: '2026-12-01' }])
    renderTela(<MetasPage />)
    expect(await screen.findByText('Batida! 🎉')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByText('agendado')).toBeTruthy()
    expect(screen.queryByText('atual')).toBeNull()
    expect(screen.queryAllByRole('button', { name: 'Abater' })).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Salvar meta' })).toBeTruthy()
  })

  it('sem meta hoje, listas vazias e usuário sem edição', async () => {
    fake.quando('GET /metas/hoje', { ...HOJE, temMeta: false, motivoSemMeta: 'SEM_VALOR' })
    fake.quando('GET /metas/valores', [])
    fake.quando('GET /metas/dias-sem-meta', [])
    fake.quando('GET /metas/mes', {
      ...MES,
      dias: [],
      resumo: { diasComMeta: 0, diasAtingidos: 0, lucroTotal: 0 },
    })
    renderTela(<MetasPage />)
    expect(await screen.findByText(/Defina o valor diário abaixo/)).toBeTruthy()
    expect(await screen.findByText('Nenhum dia para mostrar.')).toBeTruthy()
    expect(screen.getByText('Nenhum valor definido.')).toBeTruthy()
    expect(screen.getByText(/Nenhum dia marcado em Novembro de 2026/)).toBeTruthy()
    cleanup()

    logar({ id: 'tv', nome: 'TV', email: 'tv@x', papel: 'VISAO_GERAL' })
    renderTela(<MetasPage />)
    expect(await screen.findByText('Nenhuma meta definida ainda.')).toBeTruthy()
    expect(screen.getByText(/Somente o administrador/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Excluir valor' })).toBeNull()
    cleanup()

    fake.quando('GET /metas/dias-sem-meta', [{ data: '2026-11-14', motivo: 'feriado' }])
    fake.quando('GET /metas/valores', [{ id: 'mv1', valor: 500, vigenteDesde: '2026-11-01' }])
    for (const [hoje, texto] of [
      [
        { ...HOJE, temMeta: false, motivoSemMeta: 'DOMINGO', motivo: 'folga' },
        'Hoje não tem meta (Domingo — folga).',
      ],
      [{ ...HOJE, temMeta: false, motivoSemMeta: undefined }, 'Hoje não tem meta (sem meta).'],
    ] as const) {
      fake.quando('GET /metas/hoje', hoje)
      renderTela(<MetasPage />)
      expect(await screen.findByText(texto)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Remover dia sem meta' })).toBeNull()
      cleanup()
    }
    fake.quando('GET /metas/hoje', new ErroApi(500))
    renderTela(<MetasPage />)
    expect(await screen.findByText('Hoje não tem meta (sem meta).')).toBeTruthy()
  })
})
