import { vi, type Mock } from 'vitest';

type ModelMock = Record<string, Mock>;
export type PrismaMock = Record<string, ModelMock> & {
  $transaction: Mock;
  $queryRaw: Mock;
  $executeRaw: Mock;
};

/**
 * Prisma falso para testes de serviço: qualquer prisma.<modelo>.<método> vira um vi.fn()
 * (retorna undefined até o teste definir). $transaction roda o callback com o mesmo mock
 * ou resolve a lista de promessas.
 */
export function criarPrismaMock(): PrismaMock {
  const modelos = new Map<string, ModelMock>();
  const raiz: any = {
    $transaction: vi.fn(async (arg: any) =>
      typeof arg === 'function' ? arg(proxy) : Promise.all(arg),
    ),
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 0),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  const proxy: any = new Proxy(raiz, {
    get(alvo, nome: string) {
      if (nome in alvo) return alvo[nome];
      if (typeof nome !== 'string' || nome === 'then') return undefined;
      if (!modelos.has(nome)) {
        modelos.set(
          nome,
          new Proxy({} as ModelMock, {
            get(m, metodo: string) {
              if (metodo === 'then') return undefined;
              m[metodo] ??= vi.fn();
              return m[metodo];
            },
          }),
        );
      }
      return modelos.get(nome);
    },
  });
  return proxy;
}
