export const STATUS_LABEL: Record<string, string> = {
  APROVADO: 'Aprovado',
  EM_SEPARACAO: 'Em separação',
  PRONTO_PARA_ENTREGA: 'Pronto',
  EM_ENTREGA: 'Em rota',
  ENTREGUE: 'Entregue',
}

function linhaEndereco(endereco: any) {
  if (!endereco) return ''
  const cidade = endereco.cidade?.nome ?? ''
  const uf = endereco.cidade?.estado?.sigla ?? ''
  return [
    endereco.logradouro,
    endereco.numero,
    endereco.bairro,
    cidade && uf ? `${cidade}/${uf}` : cidade,
  ]
    .filter(Boolean)
    .join(', ')
}

export function textoEndereco(endereco: any) {
  return linhaEndereco(endereco)
}

export function mapsUrl(endereco: any) {
  const texto = linhaEndereco(endereco)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`
}
