import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { api } from './lib/api'
import { apiFalsa } from './test/api-falsa'
import { apiCompleta } from './test/dados'
import { logar, USUARIO } from './test/render'

// Abre cada tela do painel pelo app inteiro, com dados de exemplo
const TELAS: [string, RegExp][] = [
  ['/', /Dashboard|Bom dia|Boa tarde|Boa noite/],
  ['/metas', /Meta/],
  ['/pedidos', /Pedidos/],
  ['/clientes', /Clientes/],
  ['/produtos', /Produtos/],
  ['/estoque', /Estoque/],
  ['/lotes', /Lotes/],
  ['/fornecedores', /Fornecedores/],
  ['/relatorios', /Relatórios/],
  ['/financeiro', /Financeiro/],
  ['/solicitacoes', /Solicitações/],
  ['/devolucoes', /Devoluções/],
  ['/entregas', /entregas/i],
  ['/usuarios', /Usuários/],
  ['/investimentos', /Investimentos/],
  ['/etiqueta/et1', /Pedido #000181/],
]

describe('telas do painel', () => {
  beforeEach(() => {
    logar(USUARIO)
    apiCompleta(apiFalsa(api))
  })

  for (const [rota, titulo] of TELAS) {
    it(rota, async () => {
      window.history.pushState({}, '', rota)
      render(<App />)
      await waitFor(() => expect(screen.getAllByText(titulo).length).toBeGreaterThan(0), {
        timeout: 20_000,
      })
      await new Promise((r) => setTimeout(r, 300))
    })
  }
})
