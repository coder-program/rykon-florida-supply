import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta, CLIENTE, CLIENTE_INATIVO } from '../test/dados'
import { janela, preencher } from '../test/campos'
import { logar, renderTela, USUARIO } from '../test/render'
import { ClientesPage } from './ClientesPage'

const pdf = vi.hoisted(() => ({ textos: [] as string[], salvo: '', tabela: null as any }))
vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize() {}
    text(t: string) {
      pdf.textos.push(t)
    }
    save(nome: string) {
      pdf.salvo = nome
    }
  },
}))
vi.mock('jspdf-autotable', () => ({
  default: (_doc: unknown, opts: unknown) => (pdf.tabela = opts),
}))
const excel = vi.hoisted(() => ({ linhas: [] as any[], colunas: [] as any[] }))
vi.mock('exceljs', () => ({
  default: {
    Workbook: class {
      xlsx = { writeBuffer: async () => new ArrayBuffer(4) }
      addWorksheet() {
        return {
          set columns(c: any[]) {
            excel.colunas = c
          },
          addRows(l: any[]) {
            excel.linhas = l
          },
        }
      }
    },
  },
}))

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const abrir = () => renderTela(<ClientesPage />)

describe('Clientes', () => {
  it('lista, busca, filtro de contato pendente e exportações', async () => {
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    abrir()
    expect((await screen.findAllByText('Mercado Vale Verde')).length).toBe(2)
    expect(screen.getByText('2 cliente(s) cadastrado(s)')).toBeTruthy()
    expect(screen.getAllByText(/Barueri\/SP · PIX/).length).toBe(1)
    await waitFor(() => expect(screen.getAllByText(/próximo/).length).toBe(2))

    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/ }))
    await waitFor(() => expect(clique).toHaveBeenCalled())
    expect(excel.colunas).toHaveLength(11)
    expect(excel.linhas).toEqual([
      {
        Nome: 'Mercado Vale Verde',
        Fantasia: 'VV',
        'CNPJ/CPF': '11.222.333/0001-81',
        Telefone: '(11) 99999-8888',
        WhatsApp: '(11) 99999-8888',
        Email: 'vv@x.com',
        Cidade: 'Barueri',
        Estado: 'SP',
        Pagamento: 'PIX',
        'Necessita NF': 'Sim',
        Status: 'Ativo',
      },
      {
        Nome: 'Padaria Sol',
        Fantasia: '',
        'CNPJ/CPF': '',
        Telefone: '(11) 99999-8888',
        WhatsApp: '(11) 99999-8888',
        Email: '',
        Cidade: '',
        Estado: '',
        Pagamento: 'PIX',
        'Necessita NF': 'Nao',
        Status: 'Inativo',
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(pdf.salvo).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(pdf.tabela.body).toEqual([
      [
        'Mercado Vale Verde',
        'VV',
        '11.222.333/0001-81',
        '(11) 99999-8888',
        'Barueri/SP',
        'PIX',
        'Sim',
        'Ativo',
      ],
      ['Padaria Sol', '', '', '(11) 99999-8888', '', 'PIX', 'Nao', 'Inativo'],
    ])

    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(screen.queryAllByText('Padaria Sol')).toHaveLength(0))
    expect(screen.getByText('1 cliente(s) cadastrado(s)')).toBeTruthy()

    fake.quando('GET /clientes', [])
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/), { target: { value: 'xyz' } })
    expect((await screen.findAllByText('Nenhum cliente encontrado')).length).toBe(2)
    expect(fake.chamadas.at(-1)?.params).toEqual({ busca: 'xyz' })
    expect(screen.getByRole('button', { name: /Exportar PDF/ })).toBeDisabled()
  })

  it('cliente sem dados, com endereço incompleto e contatos que falham', async () => {
    fake.quando('GET /clientes/contatos/ultimos', [
      { clienteId: 'c9', data: '2026-01-02T12:00:00Z', proximoContato: null },
    ])
    fake.quando('GET /clientes', [
      {
        id: 'c9',
        razaoSocialOuNome: 'Sem Nada',
        statusConvite: 'CONVITE_ENVIADO',
        email: null,
        whatsapp: null,
        telefone: null,
        enderecos: [{ id: 'e', principal: false, cidade: { id: 'x', nome: 'Osasco' } }],
      },
      {
        id: 'c8',
        razaoSocialOuNome: 'Endereço Vazio',
        telefone: '11',
        enderecos: [{ id: 'e', principal: true }],
      },
    ])
    abrir()
    expect((await screen.findAllByText('Sem Nada')).length).toBe(2)
    await waitFor(() => expect(screen.getAllByText('Contato 02/01').length).toBe(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0])
    let modal = janela('Cliente')
    expect(within(modal).getByText('Sem documento ou telefone')).toBeTruthy()
    expect(within(modal).getByText('Convite gerado')).toBeTruthy()
    expect(within(modal).getByText('Osasco')).toBeTruthy()
    expect(within(modal).getByRole('button', { name: 'Gerar link de acesso' })).toBeDisabled()
    fake.quando('POST /clientes/:id/ativar-acesso', {
      linkConvite: 'https://app/convite/1',
      statusConvite: 'CONVITE_ENVIADO',
    })
    preencher('E-mail de login', ' novo@x ', modal)
    fireEvent.click(within(modal).getByRole('button', { name: 'Gerar link de acesso' }))
    expect(await within(modal).findByDisplayValue('https://app/convite/1')).toBeTruthy()
    expect(fake.feitas('POST', '/clientes/c9/ativar-acesso')[0].data).toEqual({ email: 'novo@x' })
    expect(within(modal).queryByText('WhatsApp', { selector: 'a' })).toBeNull()
    expect(within(modal).getByText('novo@x')).toBeTruthy()
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Fechar' })[0])

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[1])
    modal = janela('Cliente')
    expect(within(modal).getByText('Sem acesso')).toBeTruthy()
    expect(within(modal).getAllByText('—').length).toBeGreaterThan(2)
    expect(within(modal).getByText('Não')).toBeTruthy()
  })

  it('detalhes: gerar convite, copiar e WhatsApp; erros do convite', async () => {
    const copiar = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: copiar },
      configurable: true,
    })
    let n = 0
    fake.quando('POST /clientes/:id/ativar-acesso', () => {
      n += 1
      if (n === 1) return new ErroApi(400, 'E-mail já usado')
      if (n === 2) return new ErroApi(500, null)
      return { linkConvite: 'https://app/c/abc', statusConvite: 'CONVITE_ENVIADO' }
    })
    abrir()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalhes' }))[0])
    const modal = janela('Cliente')
    expect(within(modal).getByText('VV · 11.222.333/0001-81 · (11) 99999-8888')).toBeTruthy()
    expect(within(modal).getByText('PIX · 30 dias')).toBeTruthy()
    expect(within(modal).getByText('cliente bom')).toBeTruthy()
    expect(within(modal).getByText('Rua A, 10, sala 1, Centro, Barueri/SP, 06454-000')).toBeTruthy()
    expect(within(modal).getByText('Ref.: praça')).toBeTruthy()
    expect(within(modal).getByText('Sem acesso')).toBeTruthy()

    const gerar = within(modal).getByRole('button', { name: 'Gerar link de acesso' })
    fireEvent.click(gerar)
    expect(await within(modal).findByText('E-mail já usado')).toBeTruthy()
    fireEvent.click(gerar)
    expect(await within(modal).findByText('Não foi possível gerar o convite.')).toBeTruthy()
    fireEvent.click(gerar)
    expect(await within(modal).findByText(/Válido por 48 horas/)).toBeTruthy()
    expect(within(modal).getByText('Convite gerado')).toBeTruthy()
    const zap = within(modal).getByRole('link', { name: /WhatsApp/ })
    expect(zap.getAttribute('href')).toContain('https://wa.me/5511999998888?text=')
    fireEvent.click(within(modal).getByRole('button', { name: /Copiar/ }))
    expect(await within(modal).findByText('Copiado')).toBeTruthy()
    expect(copiar).toHaveBeenCalledWith('https://app/c/abc')
  })

  it('cliente com acesso ativo e supervisor', async () => {
    abrir()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalhes' }))[1])
    const modal = janela('Cliente')
    expect(within(modal).getByText('Já entra com o e-mail cadastrado.')).toBeTruthy()
    expect(within(modal).getByText('Nenhum endereço cadastrado.')).toBeTruthy()
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Fechar' })[0])
    cleanup()

    logar({ ...USUARIO, papel: 'SUPERVISOR' })
    fake.quando('GET /clientes', [
      { ...CLIENTE, statusConvite: 'ATIVO' },
      { ...CLIENTE_INATIVO, statusConvite: 'PENDENTE' },
    ])
    abrir()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalhes' }))[0])
    expect(within(janela('Cliente')).getByText('Já entra com vv@x.com.')).toBeTruthy()
    fireEvent.click(within(janela('Cliente')).getAllByRole('button', { name: 'Fechar' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[1])
    expect(
      within(janela('Cliente')).getByText('O administrativo libera o acesso ao app.'),
    ).toBeTruthy()
  })

  it('excluir, reativar, editar, novo e contatos', async () => {
    fake.quando('DELETE /clientes/:id', {})
    fake.quando('POST /clientes/:id/reativar', {})
    fake.quando('PUT /clientes/:id', { id: 'c1' })
    abrir()
    const excluir = await screen.findAllByRole('button', { name: 'Excluir' })
    fireEvent.click(excluir[0])
    let modal = janela('Excluir cliente')
    expect(within(modal).getByText('11.222.333/0001-81')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Excluir cliente', { selector: 'h2' })).toBeNull()
    fireEvent.click(excluir[1])
    modal = janela('Excluir cliente')
    fireEvent.click(within(modal).getByRole('button', { name: 'Excluir cliente' }))
    await waitFor(() => expect(fake.feitas('DELETE', '/clientes/c1')).toHaveLength(1))
    await waitFor(() =>
      expect(screen.queryByText('Excluir cliente', { selector: 'h2' })).toBeNull(),
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Reativar' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Reativar' })[1])
    await waitFor(() => expect(fake.feitas('POST', '/clientes/c2/reativar')).toHaveLength(2))

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[2])
    expect(janela('Editar Cliente')).toBeTruthy()
    fireEvent.click(within(janela('Editar Cliente')).getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: /Novo Cliente/ }))
    fireEvent.click(within(janela('Novo Cliente')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Novo Cliente', { selector: 'h2' })).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Contatos' })[0])
    modal = janela('Contatos — Mercado Vale Verde')
    expect(await within(modal).findByText('Pediu desconto')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText(/Contatos —/)).toBeNull()
  })
})
