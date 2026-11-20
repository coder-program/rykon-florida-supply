import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta, ITEM, pedido } from '../test/dados'
import { janela, preencher } from '../test/campos'
import { logar, renderTela, USUARIO } from '../test/render'
import { PedidosPage } from './PedidosPage'

// Arquivos gerados (PDF, Excel, recibo) são simulados: o teste só confere o que foi pedido
const h = vi.hoisted(() => ({
  pdfSalvo: vi.fn(),
  tabela: vi.fn(),
  linhasExcel: vi.fn(),
  recibo: vi.fn(),
}))
vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize() {}
    text() {}
    save = h.pdfSalvo
  },
}))
vi.mock('jspdf-autotable', () => ({ default: (_: unknown, o: unknown) => h.tabela(o) }))
vi.mock('exceljs', () => ({
  default: {
    Workbook: class {
      addWorksheet() {
        return { columns: [], addRows: h.linhasExcel }
      }
      xlsx = { writeBuffer: async () => new ArrayBuffer(1) }
    },
  },
}))
vi.mock('../lib/recibo', () => ({ baixarReciboVenda: h.recibo }))

let fake: ReturnType<typeof apiFalsa>
let confirmar: ReturnType<typeof vi.spyOn>
let alerta: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
  fake.quando('GET /usuarios/motoristas', [
    { id: 'm1', nome: 'Zé Motorista', papel: 'MOTORISTA', ativo: true },
    { id: 'v1', nome: 'Cesar', papel: 'SUPERVISOR', ativo: true },
    { id: 'm2', nome: 'Inativo', papel: 'MOTORISTA', ativo: false },
    { id: 'x', nome: 'Duda', papel: 'ADMINISTRADOR', ativo: true },
  ])
  confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
  alerta = vi.spyOn(window, 'alert').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  Object.values(h).forEach((f) => f.mockReset())
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Detalhe por id (GET /pedidos/:id) */
function detalhes(porId: Record<string, object>) {
  fake.quando(
    'GET /pedidos/:id',
    (c: { url: string }) => porId[c.url.split('/')[2]] ?? new ErroApi(404),
  )
}
const lista = (...pedidos: object[]) => fake.quando('GET /pedidos', pedidos)

async function abrir(numero: string) {
  const linha = (await screen.findAllByText(`#${numero}`)).at(-1)!.closest('tr')!
  fireEvent.click(within(linha).getByRole('button', { name: /Ações/ }))
  return janela(`Pedido #${numero}`)
}
const rota = () => screen.getByTestId('rota').textContent

describe('lista de pedidos', () => {
  it('mostra, busca, filtra e exporta', async () => {
    renderTela(<PedidosPage />)
    expect(screen.getAllByText('Carregando...').length).toBeGreaterThan(0)
    expect((await screen.findAllByText('#000181')).length).toBe(2)
    expect(screen.getByText('4 pedido(s) encontrado(s)')).toBeTruthy()
    expect(screen.getAllByText('Aguardando alteração').length).toBe(2)
    expect(screen.getAllByText('PAGO PARCIALMENTE').length).toBe(2)
    expect(screen.getAllByText('Revendedor').length).toBe(1)
    expect(screen.getAllByText(/\(revendedor\)/).length).toBe(1)
    expect(screen.getAllByText('Recibo').length).toBe(6)
    expect(screen.getAllByText('NF: Não').length).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/ }))
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled())
    const linhas = h.linhasExcel.mock.calls[0][0]
    expect(linhas).toHaveLength(4)
    expect(linhas[0]).toMatchObject({
      'Nº Pedido': 181,
      Cliente: 'Mercado Vale Verde',
      Status: 'Aguardando aprovação',
      Pagamento: 'Pix',
      'Necessita NF': 'Sim',
      'Recibo de venda': 'Sim',
      Total: 118,
    })
    expect(linhas[1]).toMatchObject({ 'Necessita NF': 'Não', 'Recibo de venda': 'Não' })
    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(h.pdfSalvo).toHaveBeenCalledWith(
      expect.stringMatching(/^pedidos-\d{4}-\d{2}-\d{2}\.pdf$/),
    )
    expect(h.tabela.mock.calls[0][0].body[0]).toEqual([
      '#000181',
      'Mercado Vale Verde',
      'Cesar',
      'Aguardando aprovação',
      'Pix',
      'Sim',
      expect.any(String),
    ])
    expect(h.tabela.mock.calls[0][0].body[1][5]).toBe('Não')

    const busca = screen.getByPlaceholderText(/Buscar por número/)
    fireEvent.change(busca, { target: { value: 'valderir' } })
    expect(screen.queryAllByText('#000181')).toHaveLength(0)
    expect(screen.getAllByText('#000184').length).toBe(2)
    fireEvent.change(busca, { target: { value: 'padaria' } })
    expect(screen.getAllByText('#000183').length).toBe(2)
    fireEvent.change(busca, { target: { value: '182' } })
    expect(screen.getAllByText('#000182').length).toBe(2)
    fireEvent.change(busca, { target: { value: 'ninguém' } })
    expect(screen.getAllByText('Nenhum pedido encontrado')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Exportar PDF/ })).toBeDisabled()
    fireEvent.change(busca, { target: { value: '' } })

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'APROVADO' } })
    await waitFor(() =>
      expect(fake.feitas('GET', '/pedidos').at(-1)?.params).toEqual({ status: 'APROVADO' }),
    )
  })

  it('pedido sem dados opcionais na exportação', async () => {
    lista({ id: 'z', status: 'X', formaPagamento: 'Y', itens: [] })
    renderTela(<PedidosPage />)
    await screen.findAllByText('#undefined')
    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/ }))
    await waitFor(() => expect(h.linhasExcel).toHaveBeenCalled())
    expect(h.linhasExcel.mock.calls[0][0][0]).toEqual({
      'Nº Pedido': '',
      Data: '',
      Cliente: '',
      Vendedor: '',
      Status: 'X',
      Pagamento: 'Y',
      'Necessita NF': 'Não',
      'Recibo de venda': 'Não',
      Total: 0,
    })
    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(h.tabela.mock.calls[0][0].body[0].slice(0, 5)).toEqual(['#000000', '', '', 'X', 'Y'])
  })

  it('novo pedido abre e fecha o cadastro', async () => {
    renderTela(<PedidosPage />)
    fireEvent.click(screen.getByRole('button', { name: /Novo Pedido/ }))
    const modal = janela('Novo Pedido')
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Novo Pedido', { selector: 'h2' })).toBeNull()
  })
})

describe('ações em lote', () => {
  it('marcar como pago: data, forma, ignorados e erros', async () => {
    fake.quando('POST /financeiro/marcar-pago/:id', (c: { url: string }) =>
      c.url.endsWith('p3') ? new ErroApi(400, ['Saldo', 'divergente']) : {},
    )
    renderTela(<PedidosPage />)
    await screen.findAllByText('#000181')
    const todos = screen.getByLabelText('Selecionar todos')
    fireEvent.click(todos)
    expect(screen.getByText('4 pedido(s) selecionado(s)')).toBeTruthy()
    fireEvent.click(todos)
    expect(screen.queryByText(/selecionado\(s\)/)).toBeNull()
    fireEvent.click(todos)

    preencher('Selecione uma ação', 'pago')
    expect(screen.getByText(/2 de 4 pedido\(s\) podem receber esta ação/)).toBeTruthy()
    preencher('Data do pagamento', '')
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled()
    preencher('Data do pagamento', '2026-11-01')
    preencher('Forma de pagamento *', 'DINHEIRO')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))

    const resultado = await waitFor(() => janela('Marcar como pago'))
    expect(within(resultado).getByText('1 pedido(s) marcado(s) como pago')).toBeTruthy()
    expect(
      within(resultado).getByText('Ignorados pelo status atual: #000182, #000184'),
    ).toBeTruthy()
    expect(within(resultado).getByText('#000183: Saldo divergente')).toBeTruthy()
    expect(fake.feitas('POST', '/financeiro/marcar-pago/p1')[0].data).toEqual({
      data: '2026-11-01',
      formaPagamento: 'DINHEIRO',
    })
    fireEvent.click(within(resultado).getByRole('button', { name: 'OK' }))
    expect(screen.queryByText(/selecionado\(s\)/)).toBeNull()
  })

  it('aprovar, entregar, nada disponível e limpar', async () => {
    fake.quando('POST /pedidos/:id/aprovar', {})
    fake.quando('POST /pedidos/:id/entregue', new ErroApi(500, null))
    renderTela(<PedidosPage />)
    await screen.findAllByText('#000181')
    const marcar = (n: string) =>
      fireEvent.click(screen.getAllByLabelText(`Selecionar pedido #${n}`)[1])

    marcar('000181')
    preencher('Selecione uma ação', 'aprovar')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p1/aprovar')).toHaveLength(1))
    fireEvent.click(within(janela('Aprovar pedidos')).getByRole('button', { name: 'OK' }))

    // desmarcar pelo checkbox do celular tira da mesma seleção
    marcar('000182')
    preencher('Selecione uma ação', 'entregue')
    fireEvent.click(screen.getAllByLabelText('Selecionar pedido #000182')[0])
    marcar('000184')
    expect(screen.getByText('Nenhuma ação disponível para os pedidos selecionados.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    marcar('000182')
    preencher('Selecione uma ação', 'entregue')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))
    const r = await waitFor(() => janela('Marcar como entregue'))
    expect(within(r).getByText('#000182: falhou')).toBeTruthy()
    fireEvent.click(within(r).getByRole('button', { name: 'Fechar' }))
  })

  it('sem permissão de lote não há seleção', async () => {
    logar({ ...USUARIO, papel: 'FINANCEIRO' })
    renderTela(<PedidosPage />)
    await screen.findAllByText('#000181')
    expect(screen.queryByLabelText('Selecionar todos')).toBeNull()
  })
})

describe('detalhe do pedido', () => {
  it('aguardando aprovação: aprovar, recibo, pagamento e etiqueta', async () => {
    detalhes({ p1: pedido(), p2: pedido({ id: 'p2', numero: 182, status: 'APROVADO' }) })
    fake.quando('POST /pedidos/:id/aprovar', {
      pedido: { status: 'APROVADO' },
      etiqueta: { id: 'et9' },
    })
    fake.quando('POST /financeiro/marcar-pago/:id', {})
    renderTela(<PedidosPage />)
    const modal = await abrir('000181')
    expect(await within(modal).findByText('Mercado Vale Verde')).toBeTruthy()
    expect(within(modal).getByText('Enviar recibo')).toBeTruthy()
    expect(within(modal).getByText(/\+R\$\s10,00/)).toBeTruthy()
    expect(within(modal).queryByText(/Lotes utilizados/)).toBeNull()

    fireEvent.click(within(modal).getByRole('button', { name: /Baixar recibo/ }))
    expect(h.recibo).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))

    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar pagamento' }))
    const pagar = janela('Registrar pagamento · #000181')
    expect(within(pagar).getByText(/R\$\s118,00/)).toBeTruthy()
    expect(within(pagar).getByDisplayValue('Pix')).toBeTruthy()
    fireEvent.click(within(pagar).getByRole('button', { name: 'Marcar como pago' }))
    await waitFor(() => expect(fake.feitas('GET', '/pedidos/p1')).toHaveLength(2))
    // o pagamento de outro pedido não troca o aberto
    expect(screen.queryByText('Registrar pagamento · #000181')).toBeNull()

    fireEvent.click(within(modal).getByRole('button', { name: 'Aprovar' }))
    expect(await within(modal).findByText('Aprovado')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: /Gerar 4 etiquetas/ }))
    expect(rota()).toBe('/etiqueta/et9')
  })

  it('rejeitar exige motivo; cancelar pede confirmação', async () => {
    detalhes({ p1: pedido() })
    fake.quando('POST /pedidos/:id/rejeitar', {})
    fake.quando('POST /pedidos/:id/cancelar', {})
    renderTela(<PedidosPage />)
    let modal = await abrir('000181')
    await within(modal).findByText('Enviar recibo')

    fireEvent.click(within(modal).getByRole('button', { name: 'Rejeitar pedido' }))
    const rejeitar = janela('Rejeitar pedido?')
    const sim = within(rejeitar).getByRole('button', { name: 'Sim, rejeitar pedido' })
    expect(sim).toBeDisabled()
    fireEvent.submit(sim.closest('form')!)
    expect(fake.feitas('POST', '/pedidos/p1/rejeitar')).toHaveLength(0)
    preencher('Motivo da rejeição', '  sem crédito ')
    fireEvent.click(sim)
    await waitFor(() =>
      expect(fake.feitas('POST', '/pedidos/p1/rejeitar')[0].data).toEqual({
        motivo: 'sem crédito',
      }),
    )
    await waitFor(() => expect(screen.queryByText('Pedido #000181', { selector: 'h2' })).toBeNull())

    modal = await abrir('000181')
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar pedido' }))
    const cancelar = janela('Cancelar pedido?')
    expect(within(cancelar).getByText(/as caixas que já saíram do estoque voltam/)).toBeTruthy()
    fireEvent.click(within(cancelar).getByRole('button', { name: 'Voltar, não cancelar' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar pedido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, cancelar pedido' }))
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p1/cancelar')).toHaveLength(1))
  })

  it('erro ao mudar status e ao excluir', async () => {
    detalhes({ p1: pedido({ cliente: null }) })
    fake.quando('POST /pedidos/:id/aprovar', new ErroApi(400, ['Produto', 'sem lote']))
    fake.quando('DELETE /pedidos/:id', new ErroApi(400, 'Pedido com pagamento'))
    renderTela(<PedidosPage />)
    const modal = await abrir('000181')
    await within(modal).findByText('Enviar recibo')
    fireEvent.click(within(modal).getByRole('button', { name: 'Aprovar' }))
    expect(await within(modal).findByText('Produto sem lote')).toBeTruthy()
    fake.quando('POST /pedidos/:id/aprovar', new ErroApi(400, 'Sem saldo'))
    fireEvent.click(within(modal).getByRole('button', { name: 'Aprovar' }))
    expect(await within(modal).findByText('Sem saldo')).toBeTruthy()
    fake.quando('POST /pedidos/:id/aprovar', () => Promise.reject(new Error('rede')))
    fireEvent.click(within(modal).getByRole('button', { name: 'Aprovar' }))
    expect(await within(modal).findByText('Não foi possível atualizar o pedido.')).toBeTruthy()

    fireEvent.click(within(modal).getByRole('button', { name: 'Rejeitar pedido' }))
    expect(screen.getByText(/Tem certeza que deseja/).textContent).toContain('de cliente?')
    fireEvent.click(screen.getByRole('button', { name: 'Voltar, não rejeitar' }))

    confirmar.mockReturnValueOnce(false)
    fireEvent.click(within(modal).getByRole('button', { name: /Excluir pedido/ }))
    expect(fake.feitas('DELETE', '/pedidos/p1')).toHaveLength(0)
    fireEvent.click(within(modal).getByRole('button', { name: /Excluir pedido/ }))
    expect(await within(modal).findByText('Pedido com pagamento')).toBeTruthy()
    fake.quando('DELETE /pedidos/:id', () => Promise.reject(new Error('rede')))
    fireEvent.click(within(modal).getByRole('button', { name: /Excluir pedido/ }))
    expect(await within(modal).findByText('Não foi possível excluir o pedido.')).toBeTruthy()
    fake.quando('DELETE /pedidos/:id', {})
    fireEvent.click(within(modal).getByRole('button', { name: /Excluir pedido/ }))
    await waitFor(() => expect(screen.queryByText('Pedido #000181', { selector: 'h2' })).toBeNull())
  })

  it('motorista, saída para entrega, entrega e etiqueta nova', async () => {
    const pronto = pedido({
      id: 'p2',
      numero: 182,
      status: 'PRONTO_PARA_ENTREGA',
      itens: [{ ...ITEM, quantidade: 1 }],
    })
    detalhes({ p2: pronto })
    lista(pronto)
    fake.quando('POST /pedidos/:id/atribuir', {
      ...pronto,
      entregadorId: null,
      entregador: { id: 'm1', nome: 'Zé Motorista' },
    })
    fake.quando('POST /pedidos/:id/em-entrega', {})
    fake.quando('POST /pedidos/:id/entregue', {})
    fake.quando('POST /etiquetas/pedido/:id', { id: 'et5' })
    renderTela(<PedidosPage />)
    const modal = await abrir('000182')
    expect(await within(modal).findByText('Nenhum motorista atribuído ainda')).toBeTruthy()
    expect(within(modal).getByRole('option', { name: 'Cesar (supervisor)' })).toBeTruthy()
    expect(within(modal).queryByRole('option', { name: 'Inativo' })).toBeNull()

    fireEvent.click(within(modal).getByRole('button', { name: 'Saiu para entrega' }))
    expect(alerta).toHaveBeenCalled()

    const select = within(modal).getByDisplayValue('Selecionar motorista')
    fireEvent.change(select, { target: { value: '' } })
    fireEvent.change(select, { target: { value: 'm1' } })
    expect(await within(modal).findByText('Atribuído: Zé Motorista')).toBeTruthy()
    // mesmo motorista do pedido: não salva de novo
    fireEvent.change(select, { target: { value: '' } })
    fireEvent.change(select, { target: { value: 'm1' } })
    expect(fake.feitas('POST', '/pedidos/p2/atribuir')).toHaveLength(1)

    // o pedido ainda não tem entregadorId: atribui antes de sair
    fireEvent.click(within(modal).getByRole('button', { name: 'Saiu para entrega' }))
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p2/em-entrega')).toHaveLength(1))
    expect(fake.feitas('POST', '/pedidos/p2/atribuir')).toHaveLength(2)
    await waitFor(() => expect(screen.queryByText('Pedido #000182', { selector: 'h2' })).toBeNull())

    const modal2 = await abrir('000182')
    await within(modal2).findByText('Nenhum motorista atribuído ainda')
    fireEvent.click(within(modal2).getByRole('button', { name: /Gerar 1 etiqueta$/ }))
    await waitFor(() => expect(rota()).toBe('/etiqueta/et5'))

    confirmar.mockReturnValueOnce(false)
    fireEvent.click(within(modal2).getByRole('button', { name: 'Marcar como entregue' }))
    expect(fake.feitas('POST', '/pedidos/p2/entregue')).toHaveLength(0)
    fireEvent.click(within(modal2).getByRole('button', { name: 'Marcar como entregue' }))
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p2/entregue')[0].data).toEqual({}))
  })

  it('motorista já atribuído sai direto; atribuição sem entregador mantém a escolha', async () => {
    const aprovado = pedido({
      id: 'p2',
      numero: 182,
      status: 'EM_SEPARACAO',
      entregadorId: 'm1',
      entregador: { id: 'm1', nome: 'Zé Motorista' },
    })
    const pronto = { ...aprovado, id: 'p3', numero: 183, status: 'PRONTO_PARA_ENTREGA' }
    detalhes({ p2: aprovado, p3: pronto })
    lista(aprovado, pronto)
    fake.quando('POST /pedidos/:id/pronto-para-entrega', {})
    fake.quando('POST /pedidos/:id/em-entrega', {})
    fake.quando('POST /pedidos/:id/atribuir', {
      ...aprovado,
      entregadorId: undefined,
      entregador: undefined,
    })
    renderTela(<PedidosPage />)
    const modal = await abrir('000182')
    expect(await within(modal).findByText('Atribuído: Zé Motorista')).toBeTruthy()
    fireEvent.change(within(modal).getByDisplayValue('Zé Motorista'), { target: { value: 'v1' } })
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p2/atribuir')).toHaveLength(1))
    expect(within(modal).getByDisplayValue('Cesar (supervisor)')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Pronto para entrega' }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/pedidos/p2/pronto-para-entrega')).toHaveLength(1),
    )

    const modal2 = await abrir('000183')
    await within(modal2).findByText('Atribuído: Zé Motorista')
    fireEvent.click(within(modal2).getByRole('button', { name: 'Saiu para entrega' }))
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p3/em-entrega')).toHaveLength(1))
    expect(fake.feitas('POST', '/pedidos/p3/atribuir')).toHaveLength(0)
  })

  it('supervisor confirma entrega com foto', async () => {
    logar({ ...USUARIO, papel: 'SUPERVISOR' })
    const aprovado = pedido({ id: 'p2', numero: 182, status: 'APROVADO', etiqueta: { id: 'et2' } })
    detalhes({ p2: aprovado })
    lista(aprovado)
    renderTela(<PedidosPage />)
    const modal = await abrir('000182')
    await within(modal).findByText('Nenhum motorista atribuído ainda')
    fireEvent.click(within(modal).getByRole('button', { name: 'Marcar como entregue' }))
    expect(screen.getByText('Confirmar entrega · #000182')).toBeTruthy()
    expect(confirmar).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' }).at(-1)!)
    expect(screen.queryByText('Confirmar entrega · #000182')).toBeNull()
    fireEvent.click(within(modal).getByRole('button', { name: /Gerar 4 etiquetas/ }))
    expect(rota()).toBe('/etiqueta/et2')
  })

  it('entregue e pago: comprovante, devoluções, lotes e alteração pendente', async () => {
    const entregue = pedido({
      id: 'p3',
      numero: 183,
      status: 'ENTREGUE',
      statusPagamento: 'PAGO',
      pagamentos: [{ valor: 118, data: '2026-11-12T12:00:00Z' }],
      entregueEm: '2026-11-11T12:00:00Z',
      recebidoPor: 'Ana',
      observacaoEntrega: 'portaria',
      fotoEntrega: '/uploads/e.jpg',
      descontoValor: 3,
      observacoes: null,
      aguardandoAlteracao: true,
      itens: [{ ...ITEM, lote: null }],
      devolucoes: [
        {
          id: 'd1',
          data: '2026-11-12T12:00:00Z',
          etiquetaToken: 'tok',
          status: 'PENDENTE',
          itensDevolvidos: '2x Morango',
          quantidadeCaixas: 2,
          valorDevolucao: 54,
          fotos: ['/a.jpg', 'https://x/b.jpg'],
          observacao: 'amassada',
          resposta: 'ok',
        },
        {
          id: 'd2',
          data: '2026-11-12T12:00:00Z',
          etiquetaToken: null,
          status: 'OUTRO',
          fotos: null,
        },
      ],
    })
    detalhes({ p3: entregue })
    lista(entregue)
    renderTela(<PedidosPage />)
    const modal = await abrir('000183')
    expect(await within(modal).findByText('Comprovante de entrega')).toBeTruthy()
    expect(within(modal).getByText('Ana')).toBeTruthy()
    expect(within(modal).getByText('portaria')).toBeTruthy()
    expect(within(modal).getByAltText('Foto da entrega')).toHaveAttribute('src', '/uploads/e.jpg')
    expect(within(modal).getByText(/em 12\/11\/2026/)).toBeTruthy()
    expect(within(modal).queryByRole('button', { name: 'Registrar pagamento' })).toBeNull()
    expect(within(modal).getByText('HISTÓRICO DE DEVOLUÇÕES')).toBeTruthy()
    expect(within(modal).getByText('Pendente')).toBeTruthy()
    expect(within(modal).getByText('OUTRO')).toBeTruthy()
    expect(within(modal).getByText(/Etiqueta —/)).toBeTruthy()
    expect(within(modal).getByText('Fotos: 2')).toBeTruthy()
    expect(within(modal).getByText('Fotos: 0')).toBeTruthy()
    expect(within(modal).getByText('Obs.: amassada')).toBeTruthy()
    expect(within(modal).getByText('Resposta: ok')).toBeTruthy()
    expect(within(modal).getByText(/-R\$\s3,00/)).toBeTruthy()
    expect(await within(modal).findByText('Lotes utilizados')).toBeTruthy()
    expect(within(modal).getByRole('button', { name: /Gerar 4 etiquetas/ })).toBeDisabled()

    fireEvent.click(
      within(modal).getByRole('button', { name: 'Ir para Solicitações de Alteração' }),
    )
    expect(rota()).toBe('/solicitacoes')
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Pedido #000183', { selector: 'h2' })).toBeNull()
  })

  it('revendedor com item sem lote; comprovante só com data; aberto pela URL', async () => {
    const revenda = pedido({
      vendedor: { id: 'r1', nome: 'Valderir', papel: 'REVENDEDOR' },
      itens: [{ ...ITEM, loteId: null, lote: null }],
      valorFrete: 0,
      pagamentos: [{ valor: 18 }],
    })
    detalhes({ p1: revenda })
    renderTela(<PedidosPage />, { rota: '/?pedido=p1' })
    const modal = await waitFor(() => janela('Pedido #000181'))
    expect(await within(modal).findByText(/Há produto sem lote/)).toBeTruthy()
    expect(within(modal).getByText(/Pedido de revendedor/)).toBeTruthy()
    expect(within(modal).queryByRole('button', { name: /Baixar recibo/ })).toBeNull()
    expect(within(modal).queryByText('Frete')).toBeNull()
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar pagamento' }))
    expect(within(janela(/Registrar pagamento/)).getByText(/R\$\s100,00/)).toBeTruthy()
    fireEvent.click(within(janela(/Registrar pagamento/)).getByRole('button', { name: 'Cancelar' }))

    // detalhe que não carrega mantém o resumo da lista
    detalhes({})
    const outro = await abrir('000182')
    await waitFor(() => expect(within(outro).queryByText(/Atualizando detalhes/)).toBeNull())

    detalhes({
      p3: pedido({
        id: 'p3',
        numero: 183,
        status: 'CANCELADO',
        entregueEm: '2026-11-11T12:00:00Z',
        etiqueta: { id: 'et1' },
        devolucoes: undefined,
      }),
    })
    const cancelado = await abrir('000183')
    expect(await within(cancelado).findByText(/Quando:/)).toBeTruthy()
    expect(within(cancelado).queryByRole('button', { name: /Editar Pedido/ })).toBeNull()
    expect(within(cancelado).queryByRole('button', { name: 'Registrar pagamento' })).toBeNull()
    fireEvent.click(within(cancelado).getByRole('button', { name: /Gerar 4 etiquetas/ }))
    expect(rota()).toBe('/etiqueta/et1')
  })
})

describe('edição do pedido', () => {
  it('lotes, divisão, campos e envio', async () => {
    detalhes({
      p1: pedido({
        formaPagamento: 'BOLETO',
        vendedorId: 'vX',
        vendedor: { id: 'vX', nome: 'Antigo', papel: 'VENDEDOR' },
        dataVencimento: null,
        observacoes: null,
        necessitaRecibo: undefined,
        valorFrete: 0,
        itens: [
          { ...ITEM, quantidade: 4 },
          { ...ITEM, id: 'i2', loteId: 'lx', quantidade: 2.4, produto: undefined, lote: undefined },
        ],
      }),
    })
    fake.quando('PATCH /pedidos/:id', pedido({ status: 'APROVADO' }))
    renderTela(<PedidosPage />)
    const modal = await abrir('000181')
    await within(modal).findByText('Antigo')
    fireEvent.click(within(modal).getByRole('button', { name: /Editar Pedido/ }))
    const form = within(modal).getByText('Editar Pedido', { selector: 'p' }).closest('form')!
    const f = within(form)
    // forma antiga e vendedor fora da lista continuam como opção
    expect(await f.findByRole('option', { name: 'Boleto' })).toBeTruthy()
    expect(f.getByRole('option', { name: 'Antigo' })).toBeTruthy()
    // lote fora dos disponíveis, mas com caixas do próprio pedido
    expect(await f.findByRole('option', { name: 'Lote atual • 2.4 cx' })).toBeTruthy()
    // l1: 6 livres + 4 do próprio pedido (a outra linha não oferece o lote já usado)
    expect((await f.findAllByRole('option', { name: /lote 7 • 10\s+cx/ })).length).toBe(1)

    const mais = () => f.getAllByRole('button', { name: 'Aumentar caixas' })
    const menos = () => f.getAllByRole('button', { name: 'Diminuir caixas' })
    expect(menos()[1]).not.toBeDisabled()
    fireEvent.click(menos()[1])
    expect(menos()[1]).toBeDisabled()
    for (let i = 0; i < 7; i++) fireEvent.click(mais()[0])
    expect(f.getByText(/Saldo insuficiente: o lote tem 10 cx/)).toBeTruthy()
    fireEvent.click(menos()[0])

    // Divide a primeira linha e escolhe o outro lote
    fireEvent.click(f.getAllByRole('button', { name: 'Dividir lote' })[0])
    expect(f.getAllByRole('button', { name: 'Remover' })).toHaveLength(3)
    const lotes = () =>
      f
        .getAllByRole('combobox')
        .filter((s) => within(s).queryByRole('option', { name: 'Selecione o lote' }))
    fireEvent.change(lotes()[1], { target: { value: 'l3' } })
    fireEvent.click(f.getAllByRole('button', { name: 'Dividir lote' })[2])
    fireEvent.click(f.getAllByRole('button', { name: 'Remover' })[3])
    expect(f.getAllByRole('button', { name: 'Remover' })).toHaveLength(3)

    fireEvent.change(f.getAllByDisplayValue('27,00')[0], { target: { value: '2800' } })
    preencher('Frete (R$)', '12', form)
    preencher('Desconto (R$)', '2', form)
    preencher('Data do pedido', '2026-11-01', form)
    preencher('Pagamento', 'PIX', form)
    preencher('Vencimento', '2026-12-01', form)
    fireEvent.change(form.querySelector('textarea')!, { target: { value: 'nova obs' } })
    fireEvent.click(f.getByLabelText('Necessita Nota Fiscal'))
    fireEvent.click(f.getByLabelText('Necessita Recibo de Venda'))
    preencher('Vendedor', 'r1', form)
    const busca = await f.findByPlaceholderText('Mercado Vale Verde')
    fireEvent.focus(busca)
    fireEvent.change(busca, { target: { value: 'padaria' } })
    fireEvent.click(f.getByRole('button', { name: 'Padaria Sol' }))

    fireEvent.click(f.getByRole('button', { name: 'Salvar Alterações' }))
    await waitFor(() => expect(fake.feitas('PATCH', '/pedidos/p1')).toHaveLength(1))
    const corpo = fake.feitas('PATCH', '/pedidos/p1')[0].data
    expect(corpo).toMatchObject({
      clienteId: 'c2',
      vendedorId: 'r1',
      data: '2026-11-01',
      valorFrete: 12,
      descontoValor: 2,
      formaPagamento: 'PIX',
      dataVencimento: '2026-12-01',
      necessitaNF: false,
      necessitaRecibo: true,
      observacoes: 'nova obs',
    })
    expect(corpo.itens).toEqual([
      { produtoId: 'a', loteId: 'l1', quantidade: 10, valorUnitario: 28 },
      { produtoId: 'a', loteId: 'l3', quantidade: 1, valorUnitario: 27 },
      { produtoId: 'a', loteId: 'lx', quantidade: 1, valorUnitario: 27 },
    ])
    expect(corpo.solicitacao).toBeUndefined()
    expect(await within(modal).findByText('Aprovado')).toBeTruthy()
    expect(within(modal).queryByText('Salvar Alterações')).toBeNull()
  })

  it('sem mudanças não manda cliente, vendedor nem data; erro e cancelar', async () => {
    detalhes({
      p1: pedido({ itens: [{ ...ITEM, loteId: null, quantidade: 0 }], formaPagamento: 'PIX' }),
    })
    fake.quando('PATCH /pedidos/:id', new ErroApi(400, ['Lote', 'obrigatório']))
    renderTela(<PedidosPage />)
    const modal = await abrir('000181')
    await within(modal).findByText('Enviar recibo')
    fireEvent.click(within(modal).getByRole('button', { name: /Editar Pedido/ }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar Alterações' }))
    expect(await within(modal).findByText('Lote obrigatório')).toBeTruthy()
    const corpo = fake.feitas('PATCH', '/pedidos/p1')[0].data
    expect(corpo.clienteId).toBeUndefined()
    expect(corpo.vendedorId).toBeUndefined()
    expect(corpo.data).toBeUndefined()
    expect(corpo.itens).toEqual([
      { produtoId: 'a', loteId: null, quantidade: 1, valorUnitario: 27 },
    ])

    fake.quando('PATCH /pedidos/:id', new ErroApi(400, 'Pedido bloqueado'))
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar Alterações' }))
    expect(await within(modal).findByText('Pedido bloqueado')).toBeTruthy()
    fake.quando('PATCH /pedidos/:id', () => Promise.reject(new Error('rede')))
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar Alterações' }))
    expect(await within(modal).findByText('Não foi possível salvar o pedido.')).toBeTruthy()

    fireEvent.click(within(modal).getAllByRole('button', { name: 'Cancelar' })[0])
    expect(within(modal).queryByText('Salvar Alterações')).toBeNull()
    expect(within(modal).getByRole('button', { name: /Editar Pedido/ })).toBeTruthy()
  })

  it('entregue: preço muda direto e quantidade vira solicitação', async () => {
    const entregue = pedido({
      id: 'p3',
      numero: 183,
      status: 'ENTREGUE',
      itens: [
        { ...ITEM, quantidade: 4 },
        { ...ITEM, id: 'i2', quantidade: 2, loteId: null },
      ],
    })
    detalhes({ p3: entregue })
    lista(entregue)
    fake.quando('PATCH /pedidos/:id', entregue)
    fake.quando('POST /pedidos/:id/solicitacoes-alteracao', {})
    renderTela(<PedidosPage />)
    const modal = await abrir('000183')
    await within(modal).findByText('Enviar recibo')
    fireEvent.click(within(modal).getByRole('button', { name: /Editar Pedido/ }))
    expect(within(modal).getByText(/a mudança vai para Solicitações de alteração/)).toBeTruthy()
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Aumentar caixas' })[1])
    fireEvent.change(within(modal).getAllByDisplayValue('27,00')[0], { target: { value: '3000' } })
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar Alterações' }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/pedidos/p3/solicitacoes-alteracao')).toHaveLength(1),
    )
    const corpo = fake.feitas('PATCH', '/pedidos/p3')[0].data
    expect(corpo.itens).toBeUndefined()
    expect(corpo.precos).toEqual([{ itemId: 'i1', valorUnitario: 30 }])
    expect(fake.feitas('POST', '/pedidos/p3/solicitacoes-alteracao')[0].data).toEqual({
      itens: [{ produtoId: 'a', loteId: undefined, quantidade: 3 }],
      observacao: 'Alteração de pedido entregue',
    })
  })

  it('entregue sem mudanças não cria solicitação', async () => {
    const entregue = pedido({ id: 'p3', numero: 183, status: 'ENTREGUE' })
    detalhes({ p3: entregue })
    lista(entregue)
    fake.quando('PATCH /pedidos/:id', entregue)
    renderTela(<PedidosPage />)
    const modal = await abrir('000183')
    await within(modal).findByText('Enviar recibo')
    fireEvent.click(within(modal).getByRole('button', { name: /Editar Pedido/ }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar Alterações' }))
    await waitFor(() => expect(fake.feitas('PATCH', '/pedidos/p3')).toHaveLength(1))
    expect(fake.feitas('PATCH', '/pedidos/p3')[0].data.precos).toBeUndefined()
    expect(fake.feitas('POST', '/pedidos/p3/solicitacoes-alteracao')).toHaveLength(0)
  })
})
