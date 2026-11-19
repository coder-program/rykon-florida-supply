import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import * as auth1 from './auth/dto/login.dto';
import * as auth2 from './auth/dto/definir-senha.dto';
import * as clientes from './clientes/dto/cliente.dto';
import * as devolucoes from './devolucoes/dto/devolucao.dto';
import * as enderecos from './enderecos/dto/enderecos.dto';
import * as entregas from './entregas/dto/entregas.dto';
import * as estoque from './estoque/dto/estoque.dto';
import * as financeiro from './financeiro/dto/financeiro.dto';
import * as fornecedores from './fornecedores/dto/fornecedor.dto';
import * as investimentos from './investimentos/dto/investimento.dto';
import * as metas from './metas/dto/meta.dto';
import * as motorista from './motorista/dto/localizacao.dto';
import * as push from './notificacoes/dto/push.dto';
import * as pedidos from './pedidos/dto/pedido.dto';
import * as produtos from './produtos/dto/produto.dto';
import * as usuarios from './usuarios/dto/usuario.dto';

const MODULOS = {
  auth1,
  auth2,
  clientes,
  devolucoes,
  enderecos,
  entregas,
  estoque,
  financeiro,
  fornecedores,
  investimentos,
  metas,
  motorista,
  push,
  pedidos,
  produtos,
  usuarios,
};

async function erros(Classe: any, dados: object) {
  const r = await validate(plainToInstance(Classe, dados) as object);
  return r.map((e) => e.property);
}

describe('DTOs', () => {
  // Passa cada campo por valores típicos do formulário: roda as conversões (@Type/@Transform)
  // e as validações de todos os DTOs
  it('todos os DTOs convertem e validam qualquer entrada sem quebrar', async () => {
    const amostras = ['', ' texto ', '12', 12, true, 'true', null, [{}], [{ produtoId: 1 }], {}];
    let classes = 0;
    for (const modulo of Object.values(MODULOS)) {
      for (const Classe of Object.values(modulo)) {
        if (typeof Classe !== 'function') continue;
        classes += 1;
        const props = getMetadataStorage()
          .getTargetValidationMetadatas(Classe, '', true, false)
          .map((m) => m.propertyName);
        for (const valor of amostras) {
          const dados = Object.fromEntries(props.map((p) => [p, valor]));
          await expect(
            validate(plainToInstance(Classe as any, dados) as object),
          ).resolves.toBeDefined();
        }
      }
    }
    expect(classes).toBeGreaterThan(40);
  });

  it('CPF/CNPJ do cliente', async () => {
    const doc = async (cnpjCpf: unknown) =>
      (await erros(clientes.CreateClienteDto, { razaoSocialOuNome: 'A', cnpjCpf })).includes(
        'cnpjCpf',
      );
    expect(await doc('529.982.247-25')).toBe(false);
    expect(await doc('11.222.333/0001-81')).toBe(false);
    expect(await doc('')).toBe(false);
    expect(await doc('111.111.111-11')).toBe(true);
    expect(await doc('529.982.247-26')).toBe(true);
    expect(await doc('11.222.333/0001-80')).toBe(true);
    expect(await doc('11.111.111/1111-11')).toBe(true);
    expect(await doc('123')).toBe(true);
    expect(await doc(123)).toBe(true);
    // CNPJ cujo dígito dá resto < 2 (vira 0)
    expect(await doc('00.000.000/0001-91')).toBe(false);
    expect(await doc('100.000.000-19')).toBe(false);
  });

  it('CPF do usuário', async () => {
    const cpf = async (valor: unknown) =>
      (await erros(usuarios.UpdateUsuarioDto, { cpf: valor })).includes('cpf');
    expect(await cpf('529.982.247-25')).toBe(false);
    expect(await cpf(null)).toBe(false);
    expect(await cpf('529.982.247-26')).toBe(true);
    expect(await cpf(52998224725)).toBe(true);
  });

  it('e-mail opcional e textos aparados', () => {
    const c = plainToInstance(clientes.UpdateClienteDto, { email: '  ', razaoSocialOuNome: ' A ' });
    expect(c.email).toBeNull();
    expect(c.razaoSocialOuNome).toBe('A');
    expect(plainToInstance(clientes.UpdateClienteDto, { email: ' a@a ' }).email).toBe('a@a');
    expect(plainToInstance(clientes.UpdateClienteDto, { email: 5 }).email).toBe(5);
  });

  it('itens da entrada de estoque viram números', () => {
    const e = plainToInstance(estoque.EntradaEstoqueDto, {
      itens: [
        {
          produtoId: 7,
          quantidade: '3',
          custoTotal: '10,5',
          numeroLote: 2,
          precoSugeridoVenda: '',
        },
        null,
      ],
    });
    expect(e.itens).toEqual([
      {
        produtoId: '7',
        quantidade: 3,
        valorProduto: 0,
        numeroLote: '2',
        precoSugeridoVenda: undefined,
      },
      {
        produtoId: '',
        quantidade: 0,
        valorProduto: 0,
        numeroLote: undefined,
        precoSugeridoVenda: undefined,
      },
    ]);
    expect(plainToInstance(estoque.EntradaEstoqueDto, { itens: 'x' }).itens).toEqual([]);

    const a = plainToInstance(estoque.AtualizarCompraDto, {
      itens: [{ id: 1, valorProduto: '5', quantidade: null, produtoId: 'p' }, {}],
    });
    expect(a.itens).toEqual([
      { id: '1', valorProduto: 5, quantidade: undefined, produtoId: 'p' },
      { id: '', valorProduto: undefined, quantidade: undefined, produtoId: undefined },
    ]);
    expect(plainToInstance(estoque.AtualizarCompraDto, { itens: 1 }).itens).toEqual([]);

    const preco = (v: unknown) =>
      plainToInstance(estoque.AtualizarLoteDto, { precoSugeridoVenda: v }).precoSugeridoVenda;
    expect(preco(undefined)).toBeUndefined();
    expect(preco('')).toBeNull();
    expect(preco(null)).toBeNull();
    expect(preco('12.5')).toBe(12.5);
  });

  it('filtro de NF aceita texto da URL', () => {
    expect(plainToInstance(pedidos.FiltrosPedidoDto, { necessitaNF: 'true' }).necessitaNF).toBe(
      true,
    );
    expect(plainToInstance(pedidos.FiltrosPedidoDto, { necessitaNF: 'false' }).necessitaNF).toBe(
      false,
    );
  });
});
