# florida-hortifruti-app

Publica os 4 sistemas em um único domínio, cada um na sua pasta:

| Endereço                                     | Sistema                        |
| -------------------------------------------- | ------------------------------ |
| `app.floridahortifruti.com.br/admin`         | `florida-hortifruti-admin`     |
| `app.floridahortifruti.com.br/vendedor`      | `florida-hortifruti-vendedor`  |
| `app.floridahortifruti.com.br/motorista`     | `florida-hortifruti-motorista` |
| `app.floridahortifruti.com.br/cliente`       | `florida-hortifruti-cliente`   |
| `app.floridahortifruti.com.br` (sem perfil)  | vai para `floridahortifruti.com.br/acessar` |

O build (`build.mjs`) instala e compila cada sistema com `vite build --base=/<perfil>/`.
Os sistemas continuam funcionando sozinhos na raiz (`base` padrão `/`), então os projetos
antigos no Vercel não quebram.

## Rodar local

```bash
npm run build     # compila os 4 em dist/<perfil>
npm run preview   # http://localhost:5190/admin, /vendedor, /motorista, /cliente
```

Para apontar para uma API, defina `VITE_API_URL` antes do build.

## Vercel

1. **Add New → Project** → repositório `rykon-florida-supply`.
2. **Root Directory:** `florida-hortifruti-app`. Deixe ligada a opção
   _Include files outside the Root Directory in the Build Step_ (o build lê as pastas vizinhas).
3. Framework, build e output já vêm do `vercel.json`. Não altere.
4. **Environment Variables:** `VITE_API_URL` = URL da API no Render.
5. **Domains:** `app.floridahortifruti.com.br` (CNAME `app` → `cname.vercel-dns.com`).

## Render (API)

| Variável                 | Valor                                                    | Para quê                       |
| ------------------------ | -------------------------------------------------------- | ------------------------------ |
| `ALLOWED_ORIGINS`        | acrescentar `https://app.floridahortifruti.com.br`       | liberar o login (CORS)         |
| `PWA_PUBLIC_URL`         | `https://app.floridahortifruti.com.br/vendedor`          | link do QR Code das etiquetas  |
| `PWA_CLIENTE_PUBLIC_URL` | `https://app.floridahortifruti.com.br/cliente`           | link do convite do cliente     |

## Login separado por sistema

Como os 4 dividem o mesmo domínio, cada um guarda o login com um nome próprio
(`fh-admin:token`, `fh-vendedor:token`, …), definido em `src/lib/session.ts` de cada sistema.
