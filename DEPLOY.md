# Guia de Deploy — Flórida Hortifruti

## Estrutura
- **Backend API**: Render (Node/NestJS + PostgreSQL)
- **Painel Admin**: Vercel
- **PWA Vendedor**: Vercel

---

## 1. Subir o repositório no GitHub

Crie um repositório no GitHub e faça push do projeto:

```bash
git init
git add .
git commit -m "chore: initial deploy setup"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

---

## 2. Deploy do Backend no Render

1. Acesse [render.com](https://render.com) e crie uma conta
2. Clique em **New** → **Blueprint** → conecte seu repositório GitHub
3. O Render vai detectar o `render.yaml` e criar automaticamente:
   - Web Service: `florida-hortifruti-api`
   - PostgreSQL: `florida-hortifruti-db`
4. Após o deploy, copie a **URL pública** da API (ex: `https://florida-hortifruti-api.onrender.com`)
5. No dashboard do Render, atualize as variáveis de ambiente:
   - `APP_PUBLIC_URL` → URL da API acima
   - `ALLOWED_ORIGINS` → URLs dos frontends Vercel (preencher após o passo 3)

> ⚠️ O plano **Starter** ($7/mês cada serviço) não hiberna. O plano **Free** hiberna após 15min de inatividade.

---

## 3. Deploy do Painel Admin no Vercel

1. Acesse [vercel.com](https://vercel.com) e conecte seu GitHub
2. Importe o repositório → defina o **Root Directory** como `florida-hortifruti-admin`
3. Framework: **Vite**
4. Em **Environment Variables**, adicione:
   ```
   VITE_API_URL = https://florida-hortifruti-api.onrender.com
   ```
5. Clique em **Deploy**
6. Copie a URL gerada (ex: `https://florida-admin.vercel.app`)

---

## 4. Deploy do PWA Vendedor no Vercel

1. No Vercel, importe o mesmo repositório novamente
2. Root Directory: `florida-hortifruti-pwa`
3. Framework: **Vite**
4. Environment Variables:
   ```
   VITE_API_URL = https://florida-hortifruti-api.onrender.com
   ```
5. Clique em **Deploy**
6. Copie a URL gerada (ex: `https://florida-pwa.vercel.app`)

---

## 5. Atualizar CORS no Render

Volte ao Render e atualize a variável:
```
ALLOWED_ORIGINS = https://florida-admin.vercel.app,https://florida-pwa.vercel.app
```
O serviço vai reiniciar automaticamente.

---

## 6. Rodar o seed em produção (primeiro acesso)

Via Render Shell (aba Shell no dashboard do serviço):
```bash
npx prisma db seed
```

Isso cria o usuário administrador e os produtos iniciais.

---

## Checklist final

- [ ] Backend acessível em `https://SUA_API.onrender.com/health`
- [ ] Login funciona no painel admin
- [ ] Login funciona no PWA
- [ ] QR Code aponta para a URL correta (APP_PUBLIC_URL)
- [ ] CORS configurado com as URLs corretas
- [ ] Senha do admin trocada após primeiro acesso

---

## Variáveis de ambiente resumidas

| Variável | Onde | Valor |
|---|---|---|
| `DATABASE_URL` | Render | Automático (via Blueprint) |
| `JWT_SECRET` | Render | Automático (generateValue) |
| `APP_PUBLIC_URL` | Render | URL do próprio Render |
| `ALLOWED_ORIGINS` | Render | URLs do Vercel (admin + pwa) |
| `VITE_API_URL` | Vercel (admin) | URL do Render |
| `VITE_API_URL` | Vercel (pwa) | URL do Render |
