// Teste de ponta a ponta: API rodando + Postgres DESCARTÁVEL (o teste cria e apaga dados).
// Uso: ver test/run-e2e.mjs (npm run test:e2e)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
// Trava contra rodar no banco de verdade: o nome do banco precisa ter "teste"
if (!/\/[^/?]*teste[^/?]*(\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('DATABASE_URL precisa apontar para um banco de teste (nome com "teste")');
}
const db = new PrismaClient();
const B = process.env.E2E_API_URL ?? 'http://127.0.0.1:3999';
let ok = 0,
  falhas = 0;
const check = (nome, cond, extra) => {
  if (cond) {
    ok++;
    console.log('  ok   ' + nome);
  } else {
    falhas++;
    console.log('  FALHA ' + nome, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : '');
  }
};
const call = async (t, m, p, body) => {
  const r = await fetch(B + p, {
    method: m,
    headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null;
  try {
    d = await r.json();
  } catch {}
  return { s: r.status, d };
};
const login = async (email, app) => {
  const r = await call(null, 'POST', '/auth/login', { email, senha: 'teste123', app });
  if (!r.d?.access_token && !r.d?.token && !r.d?.accessToken)
    throw new Error('login ' + email + ' ' + JSON.stringify(r));
  return r.d.access_token ?? r.d.token ?? r.d.accessToken;
};
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const FOTOS = [PNG, PNG, PNG];
const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

(async () => {
  const senhaHash = await bcrypt.hash('teste123', 10);
  const u = {};
  for (const [k, papel] of Object.entries({
    admin: 'ADMINISTRADOR',
    fin: 'ADMINISTRATIVO',
    sup: 'SUPERVISOR',
    vend: 'VENDEDOR',
    mot: 'MOTORISTA',
    rev: 'REVENDEDOR',
    rev2: 'REVENDEDOR',
    tv: 'VISAO_GERAL',
    cli: 'CLIENTE',
  })) {
    u[k] = await db.usuario.create({ data: { nome: k, email: `${k}@t.com`, senhaHash, papel } });
  }
  const est = await db.estado.create({ data: { nome: 'Sao Paulo', sigla: 'SP' } });
  const cid = await db.cidade.create({ data: { nome: 'Campinas', estadoId: est.id } });
  const prod = await db.produto.create({
    data: { codigoInterno: 'M1', nome: 'Morango', precoSugerido: 100, custo: 60 },
  });
  const L1 = await db.loteProduto.create({
    data: {
      produtoId: prod.id,
      numero: '1',
      quantidadeInicial: 100,
      quantidadeDisponivel: 100,
      valorUnitario: 60,
      precoSugeridoVenda: 90,
    },
  });
  const L2 = await db.loteProduto.create({
    data: {
      produtoId: prod.id,
      numero: '2',
      quantidadeInicial: 50,
      quantidadeDisponivel: 50,
      valorUnitario: 70,
    },
  });
  const cliF = await db.cliente.create({
    data: {
      razaoSocialOuNome: 'Cliente Florida',
      cnpjCpf: '11222333000181',
      telefone: '11999990000',
      email: 'c@c.com',
      observacoes: 'interno',
      usuarioId: u.cli.id,
      statusConvite: 'ATIVO',
      tokenConvite: 'tok-secreto',
    },
  });
  await db.endereco.create({
    data: {
      entidadeTipo: 'CLIENTE',
      entidadeId: cliF.id,
      logradouro: 'Rua Secreta',
      numero: '10',
      cidadeId: cid.id,
      principal: true,
    },
  });

  const t = {};
  t.admin = await login('admin@t.com', 'admin');
  t.fin = await login('fin@t.com', 'admin');
  t.sup = await login('sup@t.com', 'admin');
  t.vend = await login('vend@t.com', 'vendedor');
  t.mot = await login('mot@t.com', 'motorista');
  t.rev = await login('rev@t.com', 'vendedor');
  t.rev2 = await login('rev2@t.com', 'vendedor');
  t.tv = await login('tv@t.com', 'admin');
  t.cli = await login('cli@t.com', 'cliente');

  const novoPedido = async (tok, q = 10, extra = {}, lote = L1.id, cliente = cliF.id) => {
    const r = await call(tok, 'POST', '/pedidos', {
      clienteId: cliente,
      formaPagamento: 'PIX',
      itens: [{ produtoId: prod.id, loteId: lote, quantidade: q, valorUnitario: 100 }],
      ...extra,
    });
    if (r.s >= 300) throw new Error('pedido ' + JSON.stringify(r));
    return r.d;
  };
  const entregar = async (id) => {
    let r = await call(t.admin, 'POST', `/pedidos/${id}/aprovar`);
    if (r.s >= 300) throw new Error('aprovar ' + JSON.stringify(r));
    await call(t.admin, 'POST', `/pedidos/${id}/atribuir-entregador`, { entregadorId: u.mot.id });
    r = await call(t.admin, 'POST', `/pedidos/${id}/entregue`, {});
    if (r.s >= 300) throw new Error('entregue ' + JSON.stringify(r));
  };
  const estoque = async (id) =>
    Number((await db.loteProduto.findUnique({ where: { id } })).quantidadeDisponivel);
  const total = async (id) => Number((await db.pedido.findUnique({ where: { id } })).totalFinal);

  console.log('\n== Revendedor (item 3)');
  let r = await call(t.rev, 'GET', '/clientes');
  const c0 = (r.d ?? []).find((c) => c.id === cliF.id);
  check('lista clientes da Flórida', !!c0, r);
  check(
    'vê nome e cidade',
    c0?.razaoSocialOuNome === 'Cliente Florida' && c0?.cidade === 'Campinas',
    c0,
  );
  const texto = JSON.stringify(c0 ?? {});
  for (const seg of [
    '11222333000181',
    '11999990000',
    'c@c.com',
    'Rua Secreta',
    'interno',
    'tok-secreto',
  ])
    check('lista não expõe ' + seg, !texto.includes(seg));
  r = await call(t.rev, 'GET', '/clientes?busca=Florida');
  check(
    'busca por nome acha',
    (r.d ?? []).some((c) => c.id === cliF.id),
    r,
  );
  check('busca sem dados', !JSON.stringify(r.d).includes('11999990000'));
  r = await call(t.rev, 'GET', '/clientes?busca=11999990000');
  check('busca por telefone não acha', (r.d ?? []).length === 0, r);
  r = await call(t.rev, 'GET', '/clientes?busca=11222333');
  check('busca por CNPJ não acha', (r.d ?? []).length === 0, r);
  r = await call(t.rev, 'GET', `/clientes/${cliF.id}`);
  check(
    'detalhe sem contato',
    r.s === 200 && !JSON.stringify(r.d).match(/11999990000|Rua Secreta|tok-secreto/),
    r,
  );
  r = await call(t.rev, 'PUT', `/clientes/${cliF.id}`, { telefone: '11988887777' });
  check('não edita cliente da Flórida', r.s === 403, r.s);
  r = await call(t.rev, 'DELETE', `/clientes/${cliF.id}`);
  check('não apaga cliente da Flórida', r.s === 403, r.s);
  r = await call(t.rev, 'GET', `/enderecos/CLIENTE/${cliF.id}`);
  check('rota de endereços bloqueada', r.s === 403, r.s);
  r = await call(t.rev, 'POST', '/clientes', {
    razaoSocialOuNome: 'Cliente do Rev',
    telefone: '11977776666',
  });
  const cliR = r.d;
  check('cadastra cliente próprio', r.s < 300 && cliR?.revendedorId === u.rev.id, r);
  r = await call(t.rev, 'GET', '/clientes?busca=11977776666');
  check(
    'busca por telefone acha o próprio',
    (r.d ?? []).some((c) => c.id === cliR.id),
    r,
  );
  r = await call(t.rev2, 'GET', '/clientes');
  check('outro revendedor não vê', !(r.d ?? []).some((c) => c.id === cliR.id), r);
  r = await call(t.rev2, 'GET', '/clientes?busca=Cliente do Rev');
  check('outro revendedor não acha na busca', (r.d ?? []).length === 0, r);
  r = await call(t.admin, 'GET', '/clientes');
  check('equipe não vê cliente do revendedor', !(r.d ?? []).some((c) => c.id === cliR.id));
  check(
    'equipe vê dados completos',
    (r.d ?? []).find((c) => c.id === cliF.id)?.telefone === '11999990000',
  );
  r = await call(t.vend, 'GET', '/clientes');
  check(
    'vendedor vê clientes da Flórida',
    (r.d ?? []).some((c) => c.id === cliF.id),
  );

  const venc = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const pRev = await novoPedido(t.rev, 5, { dataVencimento: venc });
  r = await call(t.rev, 'GET', `/pedidos/${pRev.id}`);
  check(
    'pedido do revendedor sem dados do cliente',
    !JSON.stringify(r.d).match(/11999990000|Rua Secreta|tok-secreto|11222333/),
    r,
  );
  check(
    'pedido sem custo',
    r.d?.itens?.[0]?.produto?.custo === undefined,
    r.d?.itens?.[0]?.produto,
  );
  r = await call(t.admin, 'POST', `/pedidos/${pRev.id}/aprovar`);
  check('aprova pedido do revendedor', r.s < 300, r);
  r = await call(t.rev, 'GET', `/pedidos/${pRev.id}`);
  const etq = await db.etiqueta.findUnique({ where: { pedidoId: pRev.id } });
  check(
    'pedido não entrega token da etiqueta',
    !JSON.stringify(r.d).includes(etq.tokenPublico),
    r.d?.etiqueta,
  );
  r = await call(t.rev, 'GET', '/pedidos');
  check(
    'lista de pedidos sem token/contato',
    !JSON.stringify(r.d).match(new RegExp(etq.tokenPublico + '|11999990000')),
    'lista',
  );
  r = await call(t.rev, 'GET', `/etiquetas/${etq.id}`);
  check(
    'etiqueta não expõe endereço/telefone',
    !JSON.stringify(r.d).match(/11999990000|Rua Secreta/),
    r.d?.cliente,
  );
  await call(t.admin, 'POST', `/pedidos/${pRev.id}/entregue`, {});
  r = await call(t.rev, 'GET', '/devolucoes/pedidos');
  check(
    'devolução do revendedor sem token',
    (r.d ?? []).some((p) => p.pedidoId === pRev.id) &&
      !JSON.stringify(r.d).includes(etq.tokenPublico),
    r.d,
  );
  r = await call(t.vend, 'GET', `/pedidos/${pRev.id}`);
  check('vendedor não abre pedido do revendedor', r.s === 403, r.s);
  r = await call(t.admin, 'GET', `/etiquetas/${etq.id}`);
  check(
    'equipe segue imprimindo etiqueta',
    r.s === 200 && r.d?.cliente?.telefone === '11999990000',
    r.s,
  );
  r = await call(t.cli, 'GET', '/portal-cliente/pedidos');
  if (r.s === 404) r = await call(t.cli, 'GET', '/portal/pedidos');
  check(
    'portal não mostra pedido do revendedor',
    r.s === 200 && !(r.d ?? []).some((p) => p.id === pRev.id),
    r.s,
  );
  const av = await db.notificacaoCliente.findMany({ where: { pedidoId: pRev.id } });
  check('sem aviso de cobrança no pedido do revendedor', av.length === 0, av);

  console.log('\n== Cobrança (14)');
  const pV = await novoPedido(t.vend, 3, { dataVencimento: venc });
  await call(t.admin, 'POST', `/pedidos/${pV.id}/aprovar`);
  const aviso = await db.notificacaoCliente.findFirst({ where: { pedidoId: pV.id } });
  check('aviso criado', !!aviso);
  check(
    'texto no modelo novo',
    /^Olá, Cliente Florida! 🍓\nPassando para lembrar/.test(aviso?.mensagem) &&
      aviso.mensagem.includes('Chave Pix: 11 91205-0672') &&
      aviso.mensagem.endsWith('Flórida Supply Hortifruti Ltda 🍓'),
    aviso?.mensagem,
  );
  check('valor no texto', /R\$\s300,00/.test(aviso?.mensagem), aviso?.mensagem);

  console.log('\n== Entregas (15)');
  r = await call(t.admin, 'GET', `/entregas/painel?dataInicio=${hoje}&dataFim=${hoje}`);
  const acha = (d, id) => (d ?? []).find((e) => e.id === id);
  check('painel responde', r.s === 200, r);
  check('aprovado = pendente', acha(r.d, pV.id)?.situacao === 'PENDENTE', acha(r.d, pV.id));
  check('traz endereço', acha(r.d, pV.id)?.endereco?.includes('Rua Secreta'), acha(r.d, pV.id));
  r = await call(t.tv, 'GET', `/entregas/painel`);
  check('TV visualiza', r.s === 200, r.s);
  r = await call(t.tv, 'PUT', `/entregas/${pV.id}/problema`, { descricao: 'x' });
  check('TV não altera', r.s === 403, r.s);
  r = await call(t.vend, 'GET', `/entregas/painel`);
  check('vendedor sem acesso', r.s === 403, r.s);
  r = await call(t.admin, 'PUT', `/entregas/${pV.id}/data-prevista`, { dataPrevista: venc });
  check('salva data prevista', r.s < 300, r);
  r = await call(t.admin, 'PUT', `/entregas/${pV.id}/problema`, { descricao: 'Cliente fechado' });
  check('registra problema', r.s < 300, r);
  r = await call(t.admin, 'GET', `/entregas/painel`);
  check(
    'vai para problema',
    acha(r.d, pV.id)?.situacao === 'PROBLEMA' && acha(r.d, pV.id)?.dataPrevista?.startsWith(venc),
    acha(r.d, pV.id),
  );
  r = await call(t.admin, 'DELETE', `/entregas/${pV.id}/problema`);
  r = await call(t.admin, 'POST', `/pedidos/${pV.id}/em-entrega`);
  check('saiu para entrega', r.s < 300, r);
  r = await call(t.admin, 'GET', `/entregas/painel`);
  check('em rota', acha(r.d, pV.id)?.situacao === 'EM_ROTA', acha(r.d, pV.id));
  r = await call(t.admin, 'POST', `/pedidos/${pV.id}/pronto-para-entrega`);
  r = await call(t.admin, 'GET', `/entregas/painel`);
  check('volta para pendente', acha(r.d, pV.id)?.situacao === 'PENDENTE', acha(r.d, pV.id));
  await call(t.admin, 'POST', `/pedidos/${pV.id}/em-entrega`);
  await call(t.admin, 'PUT', `/entregas/${pV.id}/problema`, { descricao: 'Atraso' });
  r = await call(t.admin, 'POST', `/pedidos/${pV.id}/entregue`, {});
  check('entrega concluída', r.s < 300, r);
  r = await call(t.admin, 'GET', `/entregas/painel?dataInicio=${hoje}&dataFim=${hoje}`);
  check(
    'entregue limpa problema',
    acha(r.d, pV.id)?.situacao === 'ENTREGUE' && !acha(r.d, pV.id)?.problema,
    acha(r.d, pV.id),
  );
  r = await call(t.admin, 'PUT', `/entregas/${pV.id}/problema`, { descricao: 'x' });
  check('entrega encerrada não muda', r.s === 400, r.s);

  console.log('\n== Devoluções (8)');
  const item = (q) => [{ produtoId: prod.id, quantidade: q, motivos: ['ESTRAGADO'] }];
  const p1 = await novoPedido(t.vend, 10);
  await entregar(p1.id);
  r = await call(t.vend, 'GET', '/devolucoes/pedidos');
  check(
    'vendedor vê o pedido',
    (r.d ?? []).some((p) => p.pedidoId === p1.id),
    r.s,
  );
  check(
    'preenche cliente e produtos',
    (r.d ?? []).find((p) => p.pedidoId === p1.id)?.itens?.[0]?.nome === 'Morango',
  );
  r = await call(t.admin, 'GET', '/devolucoes/pedidos');
  check(
    'admin vê todos',
    (r.d ?? []).some((p) => p.pedidoId === p1.id),
    r.s,
  );
  r = await call(t.sup, 'GET', '/devolucoes/pedidos');
  check(
    'supervisor vê todos',
    (r.d ?? []).some((p) => p.pedidoId === p1.id),
    r.s,
  );
  r = await call(t.vend, 'POST', '/devolucoes', { pedidoId: p1.id, itens: item(2) });
  check('vendedor sem foto recusado', r.s === 400, r.s);
  r = await call(t.vend, 'POST', '/devolucoes', {
    pedidoId: p1.id,
    itens: [{ produtoId: prod.id, quantidade: 2, motivos: ['OUTROS'] }],
    fotos: FOTOS,
  });
  check('Outros exige descrição', r.s === 400, r.s);
  r = await call(t.vend, 'POST', '/devolucoes', { pedidoId: p1.id, itens: item(2), fotos: FOTOS });
  check('vendedor solicita', r.s < 300 && r.d?.status === 'PENDENTE', r);
  const dCaixa = r.d;
  const reembCx = {
    tipo: 'CAIXAS',
    data: hoje,
    quantidadeCaixas: 2,
    loteId: L2.id,
    perdaQuantidade: 2,
    perdaLoteId: L1.id,
  };
  r = await call(t.admin, 'PATCH', `/devolucoes/${dCaixa.id}/reembolso`, reembCx);
  check('reembolso antes de aprovar recusado', r.s === 400, r.s);
  r = await call(t.vend, 'PATCH', `/devolucoes/${dCaixa.id}/status`, { status: 'APROVADA' });
  check('vendedor não aprova', r.s === 403, r.s);
  r = await call(t.admin, 'PATCH', `/devolucoes/${dCaixa.id}/status`, { status: 'CONCLUIDA' });
  check('não conclui sem reembolso', r.s === 400, r.s);
  const antes = { l1: await estoque(L1.id), l2: await estoque(L2.id), tot: await total(p1.id) };
  r = await call(t.sup, 'PATCH', `/devolucoes/${dCaixa.id}/status`, { status: 'APROVADA' });
  check('supervisor aprova', r.d?.status === 'APROVADA' && r.d?.analisadoPor === 'sup', r);
  check(
    'aprovar não mexe em estoque',
    (await estoque(L1.id)) === antes.l1 && (await estoque(L2.id)) === antes.l2,
  );
  r = await call(t.sup, 'PATCH', `/devolucoes/${dCaixa.id}/status`, { status: 'NEGADA' });
  check('não nega depois de aprovada', r.s === 400, r.s);
  const lucroAntes = await call(
    t.admin,
    'GET',
    `/relatorios/lucro-diario?dataInicio=${hoje}&dataFim=${hoje}`,
  );
  r = await call(t.admin, 'PATCH', `/devolucoes/${dCaixa.id}/reembolso`, reembCx);
  check('reembolso em caixas', r.d?.status === 'CONCLUIDA', r);
  check('valor do pedido não muda', (await total(p1.id)) === antes.tot, await total(p1.id));
  check('reposição sai do lote', (await estoque(L2.id)) === antes.l2 - 2, await estoque(L2.id));
  check('devolvidas não voltam', (await estoque(L1.id)) === antes.l1, await estoque(L1.id));
  check(
    'itens do pedido intactos',
    (await db.itemPedido.count({ where: { pedidoId: p1.id } })) === 1,
  );
  let perda = await db.perdaDevolucao.findFirst({ where: { devolucaoId: dCaixa.id } });
  check('perda = custo da reposição', Number(perda?.valor) === 140, perda);
  r = await call(t.admin, 'PATCH', `/devolucoes/${dCaixa.id}/reembolso`, reembCx);
  check('não reembolsa duas vezes', r.s === 400, r.s);
  const lucroDepois = await call(
    t.admin,
    'GET',
    `/relatorios/lucro-diario?dataInicio=${hoje}&dataFim=${hoje}`,
  );
  check(
    'lucro cai 140',
    lucroDepois.s === 200 &&
      Math.abs(lucroAntes.d.geral.lucroTotal - lucroDepois.d.geral.lucroTotal - 140) < 0.01,
    [lucroAntes.d?.geral, lucroDepois.d?.geral],
  );

  const p2 = await novoPedido(t.vend, 10);
  await entregar(p2.id);
  r = await call(t.admin, 'POST', '/devolucoes', { pedidoId: p2.id, itens: item(2) });
  check(
    'admin registra sem foto, já aprovada',
    r.s < 300 && r.d?.status === 'APROVADA' && r.d?.fotos?.length === 0,
    r,
  );
  const dDin = r.d;
  const est2 = await estoque(L1.id);
  r = await call(t.admin, 'PATCH', `/devolucoes/${dDin.id}/reembolso`, {
    tipo: 'DINHEIRO',
    data: hoje,
    valor: 200,
    formaPagamento: 'PIX',
    perdaQuantidade: 2,
    perdaLoteId: L1.id,
    perdaValor: 120,
  });
  check(
    'reembolso em dinheiro',
    r.d?.status === 'CONCLUIDA' && r.d?.reembolso?.formaPagamento === 'PIX',
    r,
  );
  check('pedido reduzido', (await total(p2.id)) === 800, await total(p2.id));
  check('caixas não voltam ao estoque', (await estoque(L1.id)) === est2, await estoque(L1.id));
  const movs = await db.movimentacaoEstoque.count({ where: { pedidoId: p2.id, tipo: 'ENTRADA' } });
  check('sem entrada de estoque', movs === 0, movs);
  const ipl = await db.itemPedidoLote.findFirst({ where: { pedidoId: p2.id } });
  check('vendido por lote ajustado', Number(ipl?.quantidade) === 8, ipl);

  r = await call(t.sup, 'POST', '/devolucoes', { pedidoId: p2.id, itens: item(1) });
  check('supervisor sem foto recusado', r.s === 400, r.s);
  r = await call(t.sup, 'POST', '/devolucoes', { pedidoId: p2.id, itens: item(1), fotos: FOTOS });
  check('supervisor registra já aprovada', r.d?.status === 'APROVADA', r);

  const p3 = await novoPedido(t.vend, 4);
  await entregar(p3.id);
  r = await call(t.mot, 'GET', '/devolucoes/pedidos');
  check(
    'motorista vê o que entregou',
    (r.d ?? []).some((p) => p.pedidoId === p3.id),
    r.s,
  );
  r = await call(t.mot, 'POST', '/devolucoes', { pedidoId: p3.id, itens: item(1), fotos: FOTOS });
  check('motorista solicita', r.d?.status === 'PENDENTE', r);
  const dNeg = r.d;
  r = await call(t.fin, 'PATCH', `/devolucoes/${dNeg.id}/status`, { status: 'NEGADA' });
  check('financeiro nega', r.d?.status === 'NEGADA', r);
  r = await call(t.fin, 'PATCH', `/devolucoes/${dNeg.id}/reembolso`, {
    tipo: 'DINHEIRO',
    data: hoje,
    valor: 10,
    formaPagamento: 'PIX',
    perdaQuantidade: 1,
    perdaLoteId: L1.id,
  });
  check('negada sem reembolso', r.s === 400, r.s);

  r = await call(t.admin, 'GET', `/devolucoes/perdas?dataInicio=${hoje}&dataFim=${hoje}`);
  check(
    'card de perdas',
    r.d?.totalCaixas === 4 && r.d?.valorTotal === 260 && r.d?.itens?.length === 2,
    r.d,
  );
  r = await call(t.tv, 'GET', `/devolucoes/perdas`);
  check('TV vê perdas', r.s === 200, r.s);
  r = await call(t.admin, 'GET', `/relatorios/lucro-lote/${L1.id}`);
  check('lucro por lote desconta', r.d?.geral?.perdas === 260, r.d?.geral);
  r = await call(t.admin, 'GET', '/devolucoes/resumo');
  check(
    'resumo separa aprovadas',
    r.d?.aprovadas === 1 && r.d?.concluidas === 2 && r.d?.negadas === 1,
    r.d,
  );
  r = await call(t.admin, 'GET', `/pedidos/${p1.id}`);
  check(
    'detalhe do pedido traz devolução',
    r.d?.devolucoes?.[0]?.status === 'CONCLUIDA',
    r.d?.devolucoes,
  );
  r = await call(t.vend, 'GET', '/devolucoes/minhas');
  check(
    'vendedor vê reembolso',
    (r.d ?? []).some((d) => d.reembolso?.tipo === 'CAIXAS'),
    r.s,
  );
  r = await call(t.admin, 'GET', `/relatorios/lucro-lote/lotes`);
  check('lotes com custo', r.d?.[0]?.custoUnitario > 0, r.d?.[0]);

  console.log('\n== Editar e excluir pedido aprovado');
  const lin = (lote, q) => ({
    itens: [{ produtoId: prod.id, loteId: lote, quantidade: q, valorUnitario: 100 }],
  });
  const pE = await novoPedido(t.vend, 10);
  await call(t.admin, 'POST', `/pedidos/${pE.id}/aprovar`);
  const e1 = { l1: await estoque(L1.id), l2: await estoque(L2.id) };
  r = await call(t.admin, 'PATCH', `/pedidos/${pE.id}`, lin(L1.id, 6));
  check('edita aprovado', r.s < 300, r);
  check(
    'reduz: 4 caixas voltam ao lote',
    (await estoque(L1.id)) === e1.l1 + 4,
    await estoque(L1.id),
  );
  check('total recalculado', (await total(pE.id)) === 600, await total(pE.id));
  r = await call(t.sup, 'PATCH', `/pedidos/${pE.id}`, lin(L2.id, 6));
  check('supervisor troca o lote', r.s < 300, r);
  check('lote antigo recebe de volta', (await estoque(L1.id)) === e1.l1 + 10, await estoque(L1.id));
  check('lote novo baixa', (await estoque(L2.id)) === e1.l2 - 6, await estoque(L2.id));
  const ipls = await db.itemPedidoLote.findMany({ where: { pedidoId: pE.id } });
  check(
    'vendido por lote certo',
    ipls.length === 1 && ipls[0].loteId === L2.id && Number(ipls[0].quantidade) === 6,
    ipls,
  );
  r = await call(t.admin, 'PATCH', `/pedidos/${pE.id}`, lin(L2.id, 9999));
  check('acima do estoque recusado', r.s === 400, r.s);
  r = await call(t.vend, 'DELETE', `/pedidos/${pE.id}`);
  check('vendedor não exclui', r.s === 403, r.s);
  r = await call(t.sup, 'DELETE', `/pedidos/${pE.id}`);
  check('supervisor exclui aprovado', r.s < 300, r);
  check('pedido apagado', !(await db.pedido.findUnique({ where: { id: pE.id } })));
  check('caixas voltam ao lote', (await estoque(L2.id)) === e1.l2, await estoque(L2.id));
  r = await call(t.admin, 'DELETE', `/pedidos/${p3.id}`);
  check('entregue com devolução não exclui', r.s === 400, r.s);
  const pEnt = await novoPedido(t.vend, 5);
  await entregar(pEnt.id);
  const e3 = await estoque(L1.id);
  r = await call(t.sup, 'DELETE', `/pedidos/${pEnt.id}`);
  check('supervisor exclui entregue', r.s < 300, r);
  check(
    'entregue apagado e caixas voltam',
    !(await db.pedido.findUnique({ where: { id: pEnt.id } })) && (await estoque(L1.id)) === e3 + 5,
    [await estoque(L1.id), e3],
  );
  const pPend = await novoPedido(t.vend, 3);
  const e2 = await estoque(L1.id);
  r = await call(t.admin, 'DELETE', `/pedidos/${pPend.id}`);
  check('exclui pendente e devolve', r.s < 300 && (await estoque(L1.id)) === e2 + 3, [
    r.s,
    await estoque(L1.id),
    e2,
  ]);

  console.log('\n== Editar entrada de estoque');
  const prodB = await db.produto.create({
    data: { codigoInterno: 'B1', nome: 'Banana', precoSugerido: 50 },
  });
  r = await call(t.admin, 'POST', '/estoque/entrada', {
    fornecedor: 'Forn',
    itens: [{ produtoId: prod.id, quantidade: 50, valorProduto: 32 }],
  });
  check('entrada criada', r.s < 300, r);
  const ic = await db.itemCompraEstoque.findFirst({
    where: { produtoId: prod.id, quantidade: 50 },
    orderBy: { id: 'desc' },
    include: { movimentacao: { include: { lotes: true } } },
  });
  const loteE = ic.movimentacao.lotes[0].loteId;
  const saldo = async (pid) =>
    Number(
      (
        await db.movimentacaoEstoque.aggregate({
          where: { produtoId: pid },
          _sum: { quantidade: true },
        })
      )._sum.quantidade ?? 0,
    );
  const sM = await saldo(prod.id);
  r = await call(t.admin, 'PATCH', `/estoque/compras/${ic.compraId}`, {
    itens: [{ id: ic.id, quantidade: 60, valorProduto: 30 }],
  });
  check('edita quantidade e valor', r.s < 300, r);
  let lt = await db.loteProduto.findUnique({ where: { id: loteE } });
  check(
    'lote 60/60 e custo 30',
    Number(lt.quantidadeInicial) === 60 &&
      Number(lt.quantidadeDisponivel) === 60 &&
      Number(lt.valorUnitario) === 30,
    lt,
  );
  check('saldo do produto +10', (await saldo(prod.id)) === sM + 10, await saldo(prod.id));
  r = await call(t.admin, 'PATCH', `/estoque/compras/${ic.compraId}`, {
    itens: [{ id: ic.id, produtoId: prodB.id }],
  });
  check('troca produto sem venda', r.s < 300, r);
  lt = await db.loteProduto.findUnique({ where: { id: loteE } });
  check(
    'lote e saldo vão pro novo produto',
    lt.produtoId === prodB.id &&
      (await saldo(prodB.id)) === 60 &&
      (await saldo(prod.id)) === sM - 50,
    [lt.produtoId, await saldo(prodB.id), await saldo(prod.id)],
  );
  r = await call(t.vend, 'POST', '/pedidos', {
    clienteId: cliF.id,
    formaPagamento: 'PIX',
    itens: [{ produtoId: prodB.id, loteId: loteE, quantidade: 15, valorUnitario: 50 }],
  });
  check('pedido do lote editado', r.s < 300, r);
  r = await call(t.admin, 'PATCH', `/estoque/compras/${ic.compraId}`, {
    itens: [{ id: ic.id, quantidade: 10 }],
  });
  check('abaixo do vendido recusado', r.s === 400, r.s);
  r = await call(t.admin, 'PATCH', `/estoque/compras/${ic.compraId}`, {
    itens: [{ id: ic.id, produtoId: prod.id }],
  });
  check('troca produto com venda recusada', r.s === 400, r.s);
  r = await call(t.admin, 'PATCH', `/estoque/compras/${ic.compraId}`, {
    itens: [{ id: ic.id, quantidade: 40 }],
  });
  lt = await db.loteProduto.findUnique({ where: { id: loteE } });
  check(
    'reduz com venda: 40 ini / 25 disp',
    r.s < 300 && Number(lt.quantidadeInicial) === 40 && Number(lt.quantidadeDisponivel) === 25,
    [r.s, lt],
  );

  console.log('\n== Excluir pedido pago / reaberto');
  const pPago = await novoPedido(t.vend, 4);
  await entregar(pPago.id);
  r = await call(t.admin, 'POST', `/financeiro/pagamento/${pPago.id}`, {
    valor: 400,
    formaPagamento: 'PIX',
  });
  check('pagamento registrado', r.s < 300, r);
  r = await call(t.admin, 'DELETE', `/pedidos/${pPago.id}`);
  check('pago não exclui', r.s === 400, r);
  r = await call(t.admin, 'POST', `/financeiro/reabrir/${pPago.id}`);
  check(
    'reabre e estorna pagamentos',
    r.s < 300 && (await db.pagamentoPedido.count({ where: { pedidoId: pPago.id } })) === 0,
    r,
  );
  r = await call(t.admin, 'DELETE', `/pedidos/${pPago.id}`);
  check('reaberto exclui', r.s < 300, r);

  console.log('\n== Editar cliente e vendedor do pedido');
  const cliF2 = await db.cliente.create({
    data: { razaoSocialOuNome: 'Outro Cliente', cnpjCpf: '52998224725', telefone: '11955554444' },
  });
  const pCV = await novoPedido(t.vend, 2);
  r = await call(t.sup, 'GET', '/usuarios/vendedores');
  check(
    'lista vendedores sem motorista',
    r.s < 300 && r.d.some((v) => v.id === u.sup.id) && !r.d.some((v) => v.id === u.mot.id),
    r.s,
  );
  r = await call(t.sup, 'PATCH', `/pedidos/${pCV.id}`, {
    clienteId: cliF2.id,
    vendedorId: u.sup.id,
  });
  const pcv = await db.pedido.findUnique({ where: { id: pCV.id } });
  check(
    'troca cliente e vendedor',
    r.s < 300 && pcv.clienteId === cliF2.id && pcv.vendedorId === u.sup.id,
    r,
  );
  r = await call(t.admin, 'PATCH', `/pedidos/${pCV.id}`, { vendedorId: u.mot.id });
  check('motorista não vira vendedor', r.s === 400, r.s);
  r = await call(t.admin, 'PATCH', `/pedidos/${pCV.id}`, { vendedorId: u.rev.id });
  check('não vira pedido de revendedor', r.s === 400, r.s);
  r = await call(t.admin, 'PATCH', `/pedidos/${pCV.id}`, { clienteId: cliR.id });
  check('cliente do revendedor recusado', r.s === 403, r.s);
  r = await call(t.vend, 'PATCH', `/pedidos/${pCV.id}`, { vendedorId: u.vend.id });
  check('vendedor não edita', r.s === 403 || r.s === 404, r.s);

  console.log('\n== Pedido entregue: editar dados e pedir alteração');
  const pEdit = await novoPedido(t.vend, 5);
  await entregar(pEdit.id);
  r = await call(t.sup, 'PATCH', `/pedidos/${pEdit.id}`, {
    clienteId: cliF2.id,
    vendedorId: u.sup.id,
    data: hoje,
  });
  let pent = await db.pedido.findUnique({ where: { id: pEdit.id } });
  check(
    'entregue: troca cliente/vendedor',
    r.s < 300 &&
      pent.clienteId === cliF2.id &&
      pent.vendedorId === u.sup.id &&
      pent.status === 'ENTREGUE',
    r,
  );
  r = await call(t.sup, 'PATCH', `/pedidos/${pEdit.id}`, {
    itens: [{ produtoId: prod.id, loteId: L1.id, quantidade: 3, valorUnitario: 100 }],
  });
  check('entregue: itens direto recusado', r.s === 400, r);
  r = await call(t.vend, 'POST', `/pedidos/${pEdit.id}/solicitacoes-alteracao`, {
    itens: [{ produtoId: prod.id, quantidade: 3 }],
  });
  check('entregue: vendedor não pede alteração', r.s >= 400, r.s);
  const antesL1 = await estoque(L1.id);
  r = await call(t.sup, 'POST', `/pedidos/${pEdit.id}/solicitacoes-alteracao`, {
    itens: [{ produtoId: prod.id, loteId: L1.id, quantidade: 3 }],
  });
  check('entregue: supervisor pede alteração', r.s < 300 && r.d.status === 'PENDENTE', r);
  r = await call(t.admin, 'POST', `/solicitacoes-alteracao/${r.d.id}/aprovar`);
  pent = await db.pedido.findUnique({ where: { id: pEdit.id } });
  check(
    'aprovada: 3 cx, total 300, 2 cx voltam ao lote',
    r.s < 300 &&
      Number(pent.totalFinal) === 300 &&
      (await estoque(L1.id)) === antesL1 + 2 &&
      pent.status === 'ENTREGUE',
    [r.s, Number(pent.totalFinal)],
  );

  console.log('\n== Alterar preço do produto');
  const itemEdit = await db.itemPedido.findFirst({ where: { pedidoId: pEdit.id } });
  const estoqueAntesPreco = await estoque(L1.id);
  r = await call(t.sup, 'PATCH', `/pedidos/${pEdit.id}`, {
    precos: [{ itemId: itemEdit.id, valorUnitario: 120.5 }],
  });
  pent = await db.pedido.findUnique({ where: { id: pEdit.id }, include: { itens: true } });
  check(
    'entregue: preço muda direto (3 x 120,50)',
    r.s < 300 &&
      Number(pent.itens[0].valorUnitario) === 120.5 &&
      Number(pent.itens[0].valorTotal) === 361.5 &&
      Number(pent.totalFinal) === 361.5 &&
      pent.status === 'ENTREGUE',
    [r.s, Number(pent.totalFinal)],
  );
  check('preço não mexe no lote', (await estoque(L1.id)) === estoqueAntesPreco);
  r = await call(t.sup, 'PATCH', `/pedidos/${pEdit.id}`, {
    precos: [{ itemId: 'nao-existe', valorUnitario: 1 }],
  });
  check('preço de item de outro pedido recusado', r.s === 400, r.s);
  r = await call(t.vend, 'PATCH', `/pedidos/${pEdit.id}`, {
    precos: [{ itemId: itemEdit.id, valorUnitario: 1 }],
  });
  check('vendedor não altera preço', r.s >= 400, r.s);
  const pPreco = await novoPedido(t.vend, 2);
  const itemPreco = await db.itemPedido.findFirst({ where: { pedidoId: pPreco.id } });
  r = await call(t.admin, 'PATCH', `/pedidos/${pPreco.id}`, {
    itens: [{ produtoId: prod.id, loteId: itemPreco.loteId, quantidade: 2, valorUnitario: 80 }],
  });
  const pp = await db.pedido.findUnique({ where: { id: pPreco.id } });
  check('pendente: preço pelos itens (2 x 80)', r.s < 300 && Number(pp.subtotal) === 160, [
    r.s,
    Number(pp.subtotal),
  ]);

  console.log('\n== Pago parcialmente');
  const pP = await novoPedido(t.vend, 2);
  await entregar(pP.id);
  r = await call(t.admin, 'POST', `/financeiro/pagamento/${pP.id}`, {
    valor: 50,
    formaPagamento: 'PIX',
  });
  check('pagamento parcial', r.s < 300, r);
  r = await call(t.admin, 'GET', '/financeiro/contas-a-receber?situacao=PAGO_PARCIAL');
  check(
    'filtro PAGO_PARCIAL acha só parciais',
    r.s < 300 &&
      r.d.some((c) => c.id === pP.id) &&
      r.d.every((c) => c.valorPago > 0 && c.statusPagamento !== 'PAGO'),
    r.s,
  );
  r = await call(t.admin, 'GET', '/relatorios/vendas?statusPagamento=PAGO_PARCIAL');
  check('relatório aceita PAGO_PARCIAL', r.s < 300, r);

  console.log('\n== Remover lote');
  r = await call(t.sup, 'POST', '/estoque/entrada', {
    fornecedor: 'F',
    valorFrete: 10,
    dataLote: hoje,
    numeroLote: '77',
    itens: [
      { produtoId: prod.id, quantidade: 8, valorProduto: 50 },
      { produtoId: prodB.id, quantidade: 2, valorProduto: 50 },
    ],
  });
  check('entrada com 2 produtos', r.s < 300, r);
  const lotesE = await db.loteProduto.findMany({ where: { numero: '77' } });
  const lx = lotesE.find((l) => l.produtoId === prod.id),
    ly = lotesE.find((l) => l.produtoId === prodB.id);
  const saldoProd = async (id) =>
    Number(
      (
        await db.movimentacaoEstoque.aggregate({
          where: { produtoId: id },
          _sum: { quantidade: true },
        })
      )._sum.quantidade ?? 0,
    );
  const sAntes = await saldoProd(prod.id);
  r = await call(t.vend, 'POST', '/pedidos', {
    clienteId: cliF.id,
    formaPagamento: 'PIX',
    itens: [{ produtoId: prodB.id, loteId: ly.id, quantidade: 1, valorUnitario: 100 }],
  });
  check('pedido no lote y', r.s < 300, r);
  r = await call(t.sup, 'DELETE', `/estoque/lotes/${ly.id}`);
  check('lote com venda não sai', r.s === 400, r.s);
  r = await call(t.vend, 'DELETE', `/estoque/lotes/${lx.id}`);
  check('vendedor não remove lote', r.s === 403, r.s);
  r = await call(t.sup, 'DELETE', `/estoque/lotes/${lx.id}`);
  const itensCompra = await db.itemCompraEstoque.findMany({
    where: { compra: { fornecedor: 'F' } },
  });
  check(
    'remove lote; saldo -8; frete todo no outro item',
    r.s < 300 &&
      !(await db.loteProduto.findUnique({ where: { id: lx.id } })) &&
      (await saldoProd(prod.id)) === sAntes - 8 &&
      itensCompra.length === 1 &&
      Number(itensCompra[0].rateioFrete) === 10,
    [r, itensCompra],
  );

  console.log('\n== Contatos com cliente');
  r = await call(t.sup, 'POST', `/clientes/${cliF.id}/contatos`, {
    tipo: 'LIGACAO',
    resumo: 'Pediu tabela',
    proximoContato: hoje,
  });
  check('supervisor registra contato', r.s < 300 && r.d.usuario?.nome === 'sup', r);
  r = await call(t.sup, 'POST', `/clientes/${cliF.id}/contatos`, { tipo: 'XX', resumo: 'a' });
  check('tipo inválido recusado', r.s === 400, r.s);
  r = await call(t.vend, 'GET', `/clientes/${cliF.id}/contatos`);
  check('vendedor não vê contatos', r.s === 403, r.s);
  r = await call(t.admin, 'GET', '/clientes/contatos/ultimos');
  check(
    'últimos contatos',
    r.s < 300 && r.d.length === 1 && r.d[0].clienteId === cliF.id && !!r.d[0].proximoContato,
    r,
  );
  r = await call(t.admin, 'GET', `/clientes/${cliF.id}/contatos`);
  check(
    'histórico do cliente',
    r.s < 300 && r.d.length === 1 && r.d[0].resumo === 'Pediu tabela',
    r,
  );

  console.log('\n== Abater meta');
  r = await call(t.fin, 'POST', '/metas/valores', { valor: 1000000, vigenteDesde: hoje });
  check('financeiro define a meta', r.s < 300, r);
  const diaHoje = async () =>
    (await call(t.admin, 'GET', '/metas/mes')).d.dias.find((d) => d.data === hoje);
  let dh = await diaHoje();
  const faltaAntes = dh.falta;
  r = await call(t.sup, 'POST', '/metas/abatimentos', { data: hoje, batida: true, motivo: 'x' });
  check('supervisor não abate', r.s === 403, r.s);
  r = await call(t.fin, 'POST', '/metas/abatimentos', { data: hoje, motivo: 'x' });
  check('sem valor nem batida recusado', r.s === 400, r.s);
  r = await call(t.fin, 'POST', '/metas/abatimentos', { data: hoje, valor: 10, motivo: '' });
  check('sem motivo recusado', r.s === 400, r.s);
  r = await call(t.fin, 'POST', '/metas/abatimentos', {
    data: '2099-01-01',
    batida: true,
    motivo: 'x',
  });
  check('dia futuro recusado', r.s === 400, r.s);
  r = await call(t.fin, 'POST', '/metas/abatimentos', {
    data: hoje,
    valor: 10,
    motivo: 'Aporte do Marcelo',
  });
  dh = await diaHoje();
  check(
    'abate 10: falta cai 10',
    r.s < 300 &&
      Math.abs(dh.falta - (faltaAntes - 10)) < 0.01 &&
      dh.abatimento === 10 &&
      dh.motivoAbatimento === 'Aporte do Marcelo',
    dh,
  );
  r = await call(t.admin, 'POST', '/metas/abatimentos', {
    data: hoje,
    batida: true,
    motivo: 'Marcelo cobriu',
  });
  dh = await diaHoje();
  check('marcar batida', r.s < 300 && dh.atingida && dh.falta === 0 && dh.marcadaBatida, dh);
  r = await call(t.fin, 'DELETE', `/metas/abatimentos/${hoje}`);
  dh = await diaHoje();
  check(
    'remover abatimento volta a faltar',
    r.s < 300 && Math.abs(dh.falta - faltaAntes) < 0.01 && !dh.atingida,
    dh,
  );

  console.log(`\nRESULTADO: ${ok} ok, ${falhas} falhas`);
  await db.$disconnect();
  process.exit(falhas ? 1 : 0);
})().catch(async (e) => {
  console.log('ERRO FATAL', e.message);
  console.log(`parcial: ${ok} ok, ${falhas} falhas`);
  process.exit(2);
});
