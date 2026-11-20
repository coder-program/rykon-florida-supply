import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { campo, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { MarcarEntregueModal } from './MarcarEntregueModal'
import { RegistrarPagamentoModal } from './RegistrarPagamentoModal'
import { RastreioLotesPedido } from '../pages/RastreioLotesPedido'

/** Troca a prop do modal com ele montado (botão "trocar") */
function Alternar<T>({ valores, ver }: { valores: T[]; ver: (v: T) => ReactNode }) {
  const [i, setI] = useState(0)
  return (
    <>
      <button onClick={() => setI(i + 1)}>trocar</button>
      {ver(valores[i])}
    </>
  )
}
const trocar = () => fireEvent.click(screen.getByRole('button', { name: 'trocar' }))

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Foto: imagem que carrega (ou falha) e canvas que devolve um JPEG
let imagemFalha = false
class ImagemFalsa {
  width = 1920
  height = 1080
  onload: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  set src(_: string) {
    setTimeout(() => (imagemFalha ? this.onerror?.(new Error('x')) : this.onload?.()))
  }
}
function escolherFoto() {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } })
  return input
}

describe('MarcarEntregueModal', () => {
  beforeEach(() => {
    imagemFalha = false
    vi.stubGlobal('Image', ImagemFalsa)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,eA==',
    )
  })

  it('exige foto, envia e avisa quem abriu', async () => {
    const onClose = vi.fn()
    const onEntregue = vi.fn()
    fake.quando('POST /pedidos/:id/entregue', { id: 'p1', status: 'ENTREGUE' })
    renderTela(
      <MarcarEntregueModal
        pedido={{ id: 'p1', numero: 181 }}
        onClose={onClose}
        onEntregue={onEntregue}
      />,
    )
    expect(screen.getByText('Confirmar entrega · #000181')).toBeTruthy()
    const confirmar = screen.getByRole('button', { name: 'Confirmar entrega' })
    expect(confirmar).toBeDisabled()

    // sem arquivo não faz nada
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [] } })
    escolherFoto()
    expect(await screen.findByAltText('Foto da entrega')).toBeTruthy()
    expect(screen.getByText('Trocar foto')).toBeTruthy()
    preencher('Quem recebeu', ' Ana ')
    preencher('Observação', ' portaria ')
    fireEvent.click(confirmar)
    await waitFor(() => expect(onEntregue).toHaveBeenCalledWith({ id: 'p1', status: 'ENTREGUE' }))
    expect(fake.feitas('POST', '/pedidos/p1/entregue')[0].data).toEqual({
      recebidoPor: 'Ana',
      observacaoEntrega: 'portaria',
      fotoEntrega: 'data:image/jpeg;base64,eA==',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('foto ilegível, canvas indisponível e erro da API', async () => {
    fake.quando('POST /pedidos/:id/entregue', new ErroApi(400, 'Pedido já entregue'))
    renderTela(<MarcarEntregueModal pedido={{ id: 'p1', numero: 1 }} onClose={() => {}} />)
    imagemFalha = true
    escolherFoto()
    expect(await screen.findByText('Não foi possível ler a foto. Tente outra.')).toBeTruthy()

    imagemFalha = false
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null)
    escolherFoto()
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByAltText('Foto da entrega')).toBeNull()

    escolherFoto()
    await screen.findByAltText('Foto da entrega')
    expect(screen.queryByText(/Não foi possível ler/)).toBeNull()
    preencher('Quem recebeu', '  ')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByText('Pedido já entregue')).toBeTruthy()
    expect(fake.feitas('POST', '/pedidos/p1/entregue')[0].data.recebidoPor).toBeUndefined()

    fake.quando('POST /pedidos/:id/entregue', new ErroApi(500, null))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p1/entregue')).toHaveLength(2))
    // Sem mensagem da API: usa a padrão; cancelar limpa
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  })

  it('mensagem padrão de erro e fechado sem pedido', async () => {
    fake.quando('POST /pedidos/:id/entregue', () => Promise.reject(new Error('rede')))
    renderTela(
      <Alternar
        valores={[{ id: 'p1', numero: 1 }, null]}
        ver={(p) => <MarcarEntregueModal pedido={p} onClose={() => {}} />}
      />,
    )
    escolherFoto()
    await screen.findByAltText('Foto da entrega')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByText('Não foi possível confirmar a entrega.')).toBeTruthy()
    trocar()
    expect(screen.queryByText(/Confirmar entrega ·/)).toBeNull()
  })
})

describe('RegistrarPagamentoModal', () => {
  it('quitação total com a forma do pedido', async () => {
    fake.quando('POST /financeiro/marcar-pago/:id', {})
    const onPago = vi.fn()
    const onClose = vi.fn()
    renderTela(
      <RegistrarPagamentoModal
        pedido={{ id: 'p1', numero: 181, totalFinal: 118, formaPagamento: 'PIX' }}
        onClose={onClose}
        onPago={onPago}
      />,
    )
    expect(screen.getByText(/R\$\s118,00/)).toBeTruthy()
    expect(campo('Forma de pagamento *').value).toBe('PIX')
    preencher('Data do pagamento *', '2026-11-01')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como pago' }))
    await waitFor(() => expect(onPago).toHaveBeenCalledWith('p1'))
    expect(fake.feitas('POST', '/financeiro/marcar-pago/p1')[0].data).toEqual({
      data: '2026-11-01',
      formaPagamento: 'PIX',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('parcial: valida o valor, troca de pedido e mostra erro', async () => {
    fake.quando('POST /financeiro/pagamento/:id', new ErroApi(400, 'Valor maior que o saldo'))
    const pedido = {
      id: 'p1',
      numero: 1,
      totalFinal: 100,
      saldoDevedor: 40,
      formaPagamento: 'BOLETO',
    }
    renderTela(
      <Alternar
        valores={[pedido, { id: 'p2', numero: 2, totalFinal: '50', formaPagamento: 'PIX' }, null]}
        ver={(p) => <RegistrarPagamentoModal pedido={p} onClose={() => {}} />}
      />,
    )
    // Boleto antigo: obriga escolher uma forma atual
    expect(campo('Forma de pagamento *').value).toBe('')
    const enviar = () =>
      screen.getByRole('button', { name: /Marcar como pago|Registrar pagamento/ })
    expect(enviar()).toBeDisabled()
    preencher('Forma de pagamento *', 'DINHEIRO')
    fireEvent.click(screen.getByLabelText('Pagamento parcial'))
    expect(enviar()).toHaveTextContent('Registrar pagamento')
    expect(enviar()).toBeDisabled()
    preencher('Valor pago (R$) *', '5000')
    expect(screen.getByText('O valor passa do saldo em aberto.')).toBeTruthy()
    // envio pelo formulário com valor inválido não chama a API
    fireEvent.submit(enviar().closest('form')!)
    expect(fake.feitas('POST', '/financeiro/pagamento/p1')).toHaveLength(0)
    preencher('Valor pago (R$) *', '3000')
    fireEvent.click(enviar())
    expect(await screen.findByText('Valor maior que o saldo')).toBeTruthy()
    expect(fake.feitas('POST', '/financeiro/pagamento/p1')[0].data).toMatchObject({
      valor: 30,
      formaPagamento: 'DINHEIRO',
    })

    fake.quando('POST /financeiro/pagamento/:id', () => Promise.reject(new Error('rede')))
    fireEvent.click(enviar())
    expect(await screen.findByText('Não foi possível registrar o pagamento.')).toBeTruthy()

    trocar()
    await waitFor(() => expect(campo('Forma de pagamento *').value).toBe('PIX'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    trocar()
    expect(screen.queryByText(/Registrar pagamento ·/)).toBeNull()
  })
})

describe('RastreioLotesPedido', () => {
  it('mostra saídas e entradas do lote', async () => {
    renderTela(<RastreioLotesPedido pedidoId="p1" />)
    expect(await screen.findByText('Lotes utilizados')).toBeTruthy()
    expect(screen.getByText(/−\s*4 cx/)).toBeTruthy()
    expect(screen.getByText(/saldo 10 → 6 cx/)).toBeTruthy()
    expect(screen.getByText(/\+\s*1 cx/)).toBeTruthy()
  })
  it('pedido sem baixa', async () => {
    fake.quando('GET /pedidos/:id/lotes', {})
    renderTela(<RastreioLotesPedido pedidoId="p1" />)
    expect(await screen.findByText(/Nenhuma baixa de lote/)).toBeTruthy()
  })
})
