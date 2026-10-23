import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Select } from './ui/Input'

export type Fornecedor = {
  id: string
  nome: string
  documento: string | null
  telefone: string | null
  observacao: string | null
  ativo: boolean
}

// Escolhe o fornecedor do cadastro na entrada de lote. Entrada antiga gravada só com o
// nome (antes do cadastro) continua aparecendo como opção até alguém trocar.
export function FornecedorSelect({
  fornecedorId,
  nomeAtual,
  onChange,
  label = 'Fornecedor *',
}: {
  fornecedorId: string
  nomeAtual?: string
  onChange: (fornecedor: { id: string; nome: string }) => void
  label?: string
}) {
  const { data: fornecedores = [], isLoading } = useQuery<Fornecedor[]>({
    queryKey: ['fornecedores', 'ativos'],
    queryFn: () => api.get('/fornecedores').then((r) => r.data),
  })

  const semCadastro = !fornecedorId && !!nomeAtual

  return (
    <div className="space-y-1">
      <Select
        label={label}
        value={semCadastro ? '__antigo' : fornecedorId}
        onChange={(e) => {
          const escolhido = fornecedores.find((f) => f.id === e.target.value)
          if (escolhido) onChange({ id: escolhido.id, nome: escolhido.nome })
        }}
        required
      >
        <option value="">{isLoading ? 'Carregando...' : 'Selecione o fornecedor'}</option>
        {semCadastro && <option value="__antigo">{nomeAtual} (sem cadastro)</option>}
        {fornecedorId && !fornecedores.some((f) => f.id === fornecedorId) && nomeAtual && (
          <option value={fornecedorId}>{nomeAtual} (inativo)</option>
        )}
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </Select>
      {!isLoading && fornecedores.length === 0 && (
        <p className="text-xs text-amber-700">
          Nenhum fornecedor cadastrado. Cadastre na aba Fornecedores.
        </p>
      )}
    </div>
  )
}
