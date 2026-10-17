// Importado pelo service worker gerado pelo vite-plugin-pwa (workbox.importScripts).
// Mostra o aviso "pedido a caminho" e abre o pedido ao tocar na notificação.
self.addEventListener('push', (event) => {
  let dados = {}
  try {
    dados = event.data ? event.data.json() : {}
  } catch {
    dados = { mensagem: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Flórida Supply', {
      body: dados.mensagem || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: dados.tag,
      data: { url: dados.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const caminho = String(event.notification.data?.url || '/').replace(/^\//, '')
  const destino = new URL(caminho, self.registration.scope).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ('focus' in janela) {
          janela.navigate(destino)
          return janela.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
