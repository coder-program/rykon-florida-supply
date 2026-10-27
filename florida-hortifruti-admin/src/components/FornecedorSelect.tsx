import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { Input, Select } from './ui/Input'

export type Fornecedor = {
  id: string
  nome: string
  documento: string | null
  telefone: string | null
  observacao: string | null
  ativo: boolean
}

const NOVO = '__novo'
const EMPTY = { nome: '', documento: '', telefone: '', observacao: '' }

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
  const [cadastrando, setCadastrando] = useState(false)
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
          if (e.target.value === NOVO) {
            setCadastrando(true)
            return
          }
          const escolhido = fornecedores.find((f) => f.id === e.target.value)
          if (escolhido) onChange({ id: escolhido.id, nome: escolhido.nome })
        }}
        required
      >
        <option value="">{isLoading ? 'Carregando...' : 'Selecione o fornecedor'}</option>
        <option value={NOVO}>+ Cadastrar fornecedor</option>
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
          Nenhum fornecedor cadastrado. Use a opção “+ Cadastrar fornecedor”.
        </p>
      )}
      <NovoFornecedorModal
        open={cadastrando}
        onClose={() => setCadastrando(false)}
        onCriado={(f) => {
          setCadastrando(false)
          onChange({ id: f.id, nome: f.nome })
        }}
      />
    </div>
  )
}

// Cadastro rápido sem sair da entrada de lote. Fica sem <form> porque o seletor já está
// dentro do formulário da entrada, e o submit chegaria nele.
function NovoFornecedorModal({
  open,
  onClose,
  onCriado,
}: {
  open: boolean
  onClose: () => void
  onCriado: (fornecedor: Fornecedor) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)

  const salvar = useMutation({
    mutationFn: () => api.post<Fornecedor>('/fornecedores', form).then((r) => r.data),
    onSuccess: (criado) => {
      // Já entra na lista para o select mostrar o nome antes do refetch
      qc.setQueryData<Fornecedor[]>(['fornecedores', 'ativos'], (lista = []) =>
        [...lista, criado].sort((a, b) => a.nome.localeCompare(b.nome)),
      )
      qc.invalidateQueries({ queryKey: ['fornecedores'] })
      setForm(EMPTY)
      onCriado(criado)
    },
  })

  function fechar() {
    setForm(EMPTY)
    salvar.reset()
    onClose()
  }

  function set(campo: keyof typeof EMPTY, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const podeSalvar = !!form.nome.trim() && !salvar.isPending

  return (
    <Modal open={open} onClose={fechar} title="Cadastrar fornecedor">
      <div
        className="space-y-3"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (podeSalvar) salvar.mutate()
          }
        }}
      >
        <Input
          label="Nome *"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
          autoFocus
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="CNPJ/CPF"
            value={form.documento}
            onChange={(e) => set('documento', e.target.value)}
          />
          <Input
            label="Telefone"
            value={form.telefone}
            onChange={(e) => set('telefone', e.target.value)}
          />
        </div>
        <Input
          label="Observação"
          value={form.observacao}
          onChange={(e) => set('observacao', e.target.value)}
        />
        {salvar.isError && (
          <p className="text-xs text-red-600">
            {(salvar.error as any)?.response?.data?.message ??
              'Não foi possível cadastrar o fornecedor.'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="button" disabled={!podeSalvar} onClick={() => salvar.mutate()}>
            {salvar.isPending ? 'Salvando...' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
