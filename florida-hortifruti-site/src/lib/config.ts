export const SISTEMA_URL = (
  import.meta.env.VITE_SISTEMA_URL ?? 'https://app.floridahortifruti.com.br'
).replace(/\/$/, '')

export const WHATSAPP_NUMERO = '5511914856532'
export const WHATSAPP_LABEL = '(11) 91485-6532'
export const EMAIL = 'contato@floridahort.com'
export const INSTAGRAM = 'floridasupplyhortifruti'

export function whatsappLink(texto = 'Olá! Gostaria de uma cotação de morangos.') {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`
}

export function perfilUrl(perfil: string) {
  return `${SISTEMA_URL}/${perfil}`
}
