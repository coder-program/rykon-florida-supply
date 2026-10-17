import { api } from './api'

export type EstadoPush =
  | 'indisponivel' // navegador sem suporte (ou iPhone fora do app instalado)
  | 'instalar-ios' // iPhone/iPad: só funciona com o app adicionado à tela inicial
  | 'bloqueado' // cliente negou a permissão
  | 'desativado'
  | 'ativado'

function ehIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function instaladoNaTela() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function suportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function base64ParaUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const bruto = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}

async function inscricaoAtual() {
  const registro = await navigator.serviceWorker.getRegistration()
  return registro ? registro.pushManager.getSubscription() : null
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!suportaPush()) return ehIos() && !instaladoNaTela() ? 'instalar-ios' : 'indisponivel'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission !== 'granted') return 'desativado'
  return (await inscricaoAtual()) ? 'ativado' : 'desativado'
}

// Precisa ser chamado a partir de um toque do cliente (exigência do iPhone e do Chrome)
export async function ativarPush(): Promise<EstadoPush> {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desativado'

  const { data } = await api.get<{ chavePublica: string | null }>('/portal-cliente/push/chave-publica')
  if (!data.chavePublica) throw new Error('Notificações ainda não estão configuradas no servidor')

  const registro = await navigator.serviceWorker.ready
  const inscricao =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ParaUint8(data.chavePublica),
    }))

  await api.post('/portal-cliente/push/inscricao', inscricao.toJSON())
  return 'ativado'
}

// No logout o aparelho deixa de receber avisos dessa conta
export async function desativarPush() {
  if (!suportaPush()) return
  const inscricao = await inscricaoAtual()
  if (!inscricao) return
  await api.delete('/portal-cliente/push/inscricao', { data: { endpoint: inscricao.endpoint } })
  await inscricao.unsubscribe()
}
