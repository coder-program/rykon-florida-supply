import { describe, expect, it } from 'vitest';
import { calcularMetasDoMes, diaDaSemana, diasDoMes, valorVigenteEm } from './metas.calc';

// Novembro/2026: dia 1 é domingo
const base = (
  lucros: Record<string, number>,
  extra: Partial<Parameters<typeof calcularMetasDoMes>[0]> = {},
) =>
  calcularMetasDoMes({
    dias: diasDoMes('2026-11', '2026-11-07'),
    hoje: '2026-11-07',
    valores: [{ valor: 1000, vigenteDesde: '2026-01-01' }],
    diasSemMeta: new Set(),
    lucroPorDia: new Map(Object.entries(lucros)),
    ...extra,
  });

const dia = (r: ReturnType<typeof base>, data: string) => r.find((d) => d.data === data)!;

describe('diasDoMes', () => {
  it('lista o mês inteiro, inclusive fevereiro bissexto', () => {
    expect(diasDoMes('2026-11')).toHaveLength(30);
    expect(diasDoMes('2028-02')).toHaveLength(29);
    expect(diasDoMes('2026-02').at(-1)).toBe('2026-02-28');
  });

  it('para no dia informado', () => {
    expect(diasDoMes('2026-11', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
});

describe('diaDaSemana', () => {
  it('reconhece domingo', () => {
    expect(diaDaSemana('2026-11-01')).toBe(0);
    expect(diaDaSemana('2026-11-02')).toBe(1);
  });
});

describe('valorVigenteEm', () => {
  const valores = [
    { valor: 2000, vigenteDesde: '2026-11-10' },
    { valor: 1000, vigenteDesde: '2026-11-01' },
  ];
  it('usa o último valor vigente até a data', () => {
    expect(valorVigenteEm('2026-11-09', valores)).toBe(1000);
    expect(valorVigenteEm('2026-11-10', valores)).toBe(2000);
  });
  it('sem valor anterior devolve null', () => {
    expect(valorVigenteEm('2026-10-31', valores)).toBeNull();
  });
});

describe('calcularMetasDoMes', () => {
  it('domingo não tem meta', () => {
    const d = dia(base({}), '2026-11-01');
    expect(d.temMeta).toBe(false);
    expect(d.motivoSemMeta).toBe('DOMINGO');
  });

  it('o que faltou passa para o próximo dia com meta', () => {
    const r = base({ '2026-11-02': 600 });
    expect(dia(r, '2026-11-02').falta).toBe(400);
    expect(dia(r, '2026-11-03').acumulado).toBe(400);
    expect(dia(r, '2026-11-03').meta).toBe(1400);
  });

  it('sobra não abate a meta do dia seguinte', () => {
    const r = base({ '2026-11-02': 5000 });
    expect(dia(r, '2026-11-02').atingida).toBe(true);
    expect(dia(r, '2026-11-03').meta).toBe(1000);
  });

  it('dia sem meta não mexe no acumulado', () => {
    const r = base({ '2026-11-02': 0 }, { diasSemMeta: new Set(['2026-11-03']) });
    expect(dia(r, '2026-11-03').motivoSemMeta).toBe('SEM_META');
    expect(dia(r, '2026-11-04').acumulado).toBe(1000);
  });

  it('sem valor definido não tem meta', () => {
    const r = base({}, { valores: [] });
    expect(r.every((d) => !d.temMeta)).toBe(true);
    expect(dia(r, '2026-11-02').motivoSemMeta).toBe('SEM_VALOR');
  });

  it('valor abatido conta como lucro só para a meta', () => {
    const r = base(
      { '2026-11-02': 600 },
      { abatimentos: new Map([['2026-11-02', { batida: false, valor: 300 }]]) },
    );
    expect(dia(r, '2026-11-02').lucro).toBe(600);
    expect(dia(r, '2026-11-02').falta).toBe(100);
    expect(dia(r, '2026-11-03').acumulado).toBe(100);
  });

  it('dia marcado como batido não deixa falta', () => {
    const r = base({}, { abatimentos: new Map([['2026-11-02', { batida: true, valor: 0 }]]) });
    expect(dia(r, '2026-11-02').atingida).toBe(true);
    expect(dia(r, '2026-11-02').marcadaBatida).toBe(true);
    expect(dia(r, '2026-11-03').meta).toBe(1000);
  });

  it('arredonda centavos', () => {
    const r = base({ '2026-11-02': 999.995 });
    expect(dia(r, '2026-11-02').lucro).toBe(1000);
  });

  it('marca o dia de hoje como em andamento', () => {
    expect(dia(base({}), '2026-11-07').emAndamento).toBe(true);
    expect(dia(base({}), '2026-11-06').emAndamento).toBe(false);
  });
});
