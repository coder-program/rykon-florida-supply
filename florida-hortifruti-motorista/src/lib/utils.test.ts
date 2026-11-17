import { describe, expect, it } from 'vitest'
import { mapsUrl, textoEndereco } from './utils'

const endereco = {
  logradouro: 'Rua das Flores',
  numero: '10',
  bairro: 'Centro',
  cidade: { nome: 'Curitiba', estado: { sigla: 'PR' } },
}

describe('endereço da entrega', () => {
  it('monta a linha com cidade/UF e pula o que falta', () => {
    expect(textoEndereco(endereco)).toBe('Rua das Flores, 10, Centro, Curitiba/PR')
    expect(textoEndereco({ logradouro: 'Rua A', cidade: { nome: 'Curitiba' } })).toBe(
      'Rua A, Curitiba',
    )
    expect(textoEndereco(null)).toBe('')
  })
  it('link do Maps com o endereço codificado', () => {
    expect(mapsUrl(endereco)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%2C%2010%2C%20Centro%2C%20Curitiba%2FPR',
    )
  })
})
