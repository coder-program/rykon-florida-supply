import { MOTIVOS_DEVOLUCAO, type SelecaoMotivos } from '../lib/motivosDevolucao'

export function MotivosDevolucao({
  valor,
  onChange,
}: {
  valor: SelecaoMotivos
  onChange: (valor: SelecaoMotivos) => void
}) {
  function alternar(motivo: string) {
    const motivos = valor.motivos.includes(motivo)
      ? valor.motivos.filter((m) => m !== motivo)
      : [...valor.motivos, motivo]
    onChange({ ...valor, motivos })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {MOTIVOS_DEVOLUCAO.map((m) => {
          const ativo = valor.motivos.includes(m.valor)
          return (
            <button
              key={m.valor}
              type="button"
              onClick={() => alternar(m.valor)}
              aria-pressed={ativo}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                ativo
                  ? 'border-red-500 bg-red-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      {valor.motivos.includes('OUTROS') && (
        <input
          value={valor.motivoOutro}
          onChange={(e) => onChange({ ...valor, motivoOutro: e.target.value })}
          placeholder="Escreva o motivo"
          className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-400"
        />
      )}
    </div>
  )
}
