import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

type Chamada = { metodo: string; url: string; data: any; params: any }
type Resposta = unknown | ((c: Chamada) => unknown)

/** Erro como o da API (status + mensagem), para responder numa rota */
export class ErroApi {
  status: number
  message: unknown
  constructor(status: number, message: unknown = 'Erro') {
    this.status = status
    this.message = message
  }
}

/**
 * API simulada no próprio axios do app: cada rota ("GET /pedidos/:id") devolve o que o teste
 * definir. Passa pelos interceptors de verdade (token, 401). Rota não definida responde 404.
 */
export function apiFalsa(api: AxiosInstance) {
  const rotas: [RegExp, string, Resposta][] = []
  const chamadas: Chamada[] = []

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const metodo = (config.method ?? 'get').toUpperCase()
    const url = (config.url ?? '').split('?')[0]
    let data = config.data
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        // corpo que não é JSON (FormData, texto)
      }
    }
    const chamada = { metodo, url, data, params: config.params }
    chamadas.push(chamada)

    const rota = [...rotas].reverse().find(([re, m]) => m === metodo && re.test(url))
    const resposta = rota
      ? typeof rota[2] === 'function'
        ? await (rota[2] as (c: Chamada) => unknown)(chamada)
        : rota[2]
      : new ErroApi(404, `Sem resposta para ${metodo} ${url}`)

    if (resposta instanceof ErroApi) {
      return Promise.reject({
        isAxiosError: true,
        message:
          resposta.message == null
            ? `Request failed with status code ${resposta.status}`
            : String(resposta.message),
        config,
        response: { status: resposta.status, data: { message: resposta.message }, config },
      })
    }
    return { data: resposta, status: 200, statusText: 'OK', headers: {}, config }
  }

  return {
    chamadas,
    /** quando('GET /pedidos/:id', dados) */
    quando(chave: string, resposta: Resposta) {
      const [metodo, caminho] = chave.split(' ')
      const re = new RegExp(`^${caminho.replace(/:[^/]+/g, '[^/]+')}$`)
      rotas.push([re, metodo, resposta])
      return this
    },
    /** Chamadas feitas para um método + caminho exato */
    feitas(metodo: string, url: string) {
      return chamadas.filter((c) => c.metodo === metodo && c.url === url)
    },
  }
}
