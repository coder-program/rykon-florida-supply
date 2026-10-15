// Regras da meta diária de lucro (definidas pelo P.O.):
// - Meta do dia = valor base vigente + o que faltou para bater a meta no último dia com meta.
// - Lucro acima da meta NÃO abate a meta do dia seguinte.
// - O acumulado zera todo mês (o cálculo sempre começa no dia 1º).
// - Domingos e dias marcados como "sem meta" (feriados) não têm meta e não mexem no acumulado.

export type ValorVigente = { valor: number; vigenteDesde: string }; // vigenteDesde: 'YYYY-MM-DD'

export type DiaMeta = {
  data: string; // 'YYYY-MM-DD'
  lucro: number;
  temMeta: boolean;
  motivoSemMeta?: 'DOMINGO' | 'SEM_META' | 'SEM_VALOR';
  base: number;
  acumulado: number; // quanto veio do(s) dia(s) anterior(es)
  meta: number;
  falta: number; // quanto falta (hoje) ou faltou (dias passados) para bater a meta
  atingida: boolean;
  emAndamento: boolean; // é hoje
};

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
}): DiaMeta[] {
  const { dias, hoje, valores, diasSemMeta, lucroPorDia } = params;
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
        atingida: false,
        emAndamento,
      };
    }

    const meta = centavos(base! + acumulado);
    const falta = centavos(Math.max(0, meta - lucro));
    const dia: DiaMeta = {
      data,
      lucro,
      temMeta: true,
      base: base!,
      acumulado,
      meta,
      falta,
      atingida: falta === 0,
      emAndamento,
    };
    acumulado = falta; // o que faltou vai para o próximo dia com meta (sobra não abate)
    return dia;
  });
}
