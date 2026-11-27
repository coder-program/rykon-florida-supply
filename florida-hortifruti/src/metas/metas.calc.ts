// Regras da meta diária de lucro (definidas pelo P.O.):
// - Meta do dia = valor base vigente + o saldo do último dia com meta, nos dois sentidos:
//   o que faltou aumenta a meta do próximo dia; o que sobrou reduz (alívio). Se a sobra passar
//   da meta do dia, o crédito restante continua para os dias seguintes.
// - O acumulado zera todo mês (o cálculo sempre começa no dia 1º).
// - Domingos e dias marcados como "sem meta" (feriados) não têm meta e não mexem no acumulado.
// - Abatimento (admin/financeiro): o dia marcado como batido não deixa falta; o valor abatido
//   conta como lucro só para a meta.

export type ValorVigente = { valor: number; vigenteDesde: string }; // vigenteDesde: 'YYYY-MM-DD'

export type DiaMeta = {
  data: string; // 'YYYY-MM-DD'
  lucro: number;
  temMeta: boolean;
  motivoSemMeta?: 'DOMINGO' | 'SEM_META' | 'SEM_VALOR';
  base: number;
  acumulado: number; // saldo vindo do(s) dia(s) anterior(es): > 0 faltou, < 0 crédito (sobra)
  meta: number;
  falta: number; // quanto falta (hoje) ou faltou (dias passados) para bater a meta
  saldo: number; // o que o dia deixa para o próximo: > 0 sobra (alívio), < 0 falta
  atingida: boolean;
  emAndamento: boolean; // é hoje
  abatimento: number; // valor abatido à mão
  marcadaBatida: boolean;
};

export type Abatimento = { batida: boolean; valor: number };

export function diaDaSemana(data: string) {
  const [y, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
}

export function diasDoMes(mes: string, ate?: string) {
  const [y, m] = mes.split('-').map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dias: string[] = [];
  for (let d = 1; d <= total; d++) {
    const data = `${mes}-${String(d).padStart(2, '0')}`;
    if (ate && data > ate) break;
    dias.push(data);
  }
  return dias;
}

export function valorVigenteEm(data: string, valores: ValorVigente[]) {
  let atual: number | null = null;
  for (const v of [...valores].sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde))) {
    if (v.vigenteDesde <= data) atual = v.valor;
  }
  return atual;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

export function calcularMetasDoMes(params: {
  dias: string[]; // dias do mês até hoje, em ordem
  hoje: string;
  valores: ValorVigente[];
  diasSemMeta: Set<string>;
  lucroPorDia: Map<string, number>;
  abatimentos?: Map<string, Abatimento>;
}): DiaMeta[] {
  const { dias, hoje, valores, diasSemMeta, lucroPorDia, abatimentos = new Map() } = params;
  let acumulado = 0;

  return dias.map((data) => {
    const lucro = centavos(lucroPorDia.get(data) ?? 0);
    const emAndamento = data === hoje;
    const base = valorVigenteEm(data, valores);

    const motivoSemMeta =
      diaDaSemana(data) === 0
        ? 'DOMINGO'
        : diasSemMeta.has(data)
          ? 'SEM_META'
          : base === null || base <= 0
            ? 'SEM_VALOR'
            : undefined;

    if (motivoSemMeta) {
      return {
        data,
        lucro,
        temMeta: false,
        motivoSemMeta,
        base: 0,
        acumulado: 0,
        meta: 0,
        falta: 0,
        saldo: 0,
        atingida: false,
        emAndamento,
        abatimento: 0,
        marcadaBatida: false,
      };
    }

    const metaBruta = centavos(base! + acumulado); // negativa = crédito maior que a base
    const meta = Math.max(0, metaBruta);
    const abatido = abatimentos.get(data);
    const abatimento = centavos(abatido?.valor ?? 0);
    const marcadaBatida = !!abatido?.batida;
    let proximo = centavos(metaBruta - lucro - abatimento);
    if (marcadaBatida) proximo = Math.min(0, proximo); // batida à mão não deixa falta
    const falta = Math.max(0, proximo);
    const dia: DiaMeta = {
      data,
      lucro,
      temMeta: true,
      base: base!,
      acumulado,
      meta,
      falta,
      saldo: centavos(-proximo),
      atingida: falta === 0,
      emAndamento,
      abatimento,
      marcadaBatida,
    };
    acumulado = proximo; // falta aumenta, sobra reduz a meta do próximo dia com meta
    return dia;
  });
}
