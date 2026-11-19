import { describe, expect, it, vi } from 'vitest';
import { AppModule } from './app.module';
import { AuthController } from './auth/auth.controller';
import { ClientesController } from './clientes/clientes.controller';
import { DevolucoesController } from './devolucoes/devolucoes.controller';
import { EnderecosController } from './enderecos/enderecos.controller';
import { EntregasController } from './entregas/entregas.controller';
import { EstoqueController } from './estoque/estoque.controller';
import { EtiquetasController } from './etiquetas/etiquetas.controller';
import { FinanceiroController } from './financeiro/financeiro.controller';
import { FornecedoresController } from './fornecedores/fornecedores.controller';
import { InvestimentosController } from './investimentos/investimentos.controller';
import { LocalidadesController } from './localidades/localidades.controller';
import { MetasController } from './metas/metas.controller';
import { MotoristaController } from './motorista/motorista.controller';
import { PedidosController } from './pedidos/pedidos.controller';
import { SolicitacoesAlteracaoController } from './pedidos/solicitacoes-alteracao.controller';
import { PortalClienteController } from './portal-cliente/portal-cliente.controller';
import { CategoriasController, ProdutosController } from './produtos/produtos.controller';
import { RelatoriosController } from './relatorios/relatorios.controller';
import { UsuariosController } from './usuarios/usuarios.controller';

// Valor "coringa" para qualquer parâmetro de rota: string, DTO, req (req.user.id), res (res.send)
const CORINGA: any = new Proxy(function () {}, {
  get: (_alvo, prop) => {
    if (prop === Symbol.toPrimitive) return () => 'x';
    if (prop === 'then') return undefined;
    return CORINGA;
  },
  apply: () => CORINGA,
});

// Serviço falso: qualquer método é um vi.fn() que devolve o coringa
function servicoFalso() {
  const fns: Record<string, any> = {};
  return new Proxy(fns, {
    get: (alvo, nome: string) => {
      if (nome === 'then') return undefined;
      alvo[nome] ??= vi.fn(async () => CORINGA);
      return alvo[nome];
    },
  });
}

const CONTROLLERS: [string, new (...args: any[]) => any, number][] = [
  ['Auth', AuthController, 1],
  ['Clientes', ClientesController, 2],
  ['Devolucoes', DevolucoesController, 1],
  ['Enderecos', EnderecosController, 1],
  ['Entregas', EntregasController, 1],
  ['Estoque', EstoqueController, 1],
  ['Etiquetas', EtiquetasController, 1],
  ['Financeiro', FinanceiroController, 1],
  ['Fornecedores', FornecedoresController, 1],
  ['Investimentos', InvestimentosController, 1],
  ['Localidades', LocalidadesController, 1],
  ['Metas', MetasController, 1],
  ['Motorista', MotoristaController, 1],
  ['Pedidos', PedidosController, 1],
  ['SolicitacoesAlteracao', SolicitacoesAlteracaoController, 1],
  ['PortalCliente', PortalClienteController, 2],
  ['Produtos', ProdutosController, 1],
  ['Categorias', CategoriasController, 1],
  ['Relatorios', RelatoriosController, 1],
  ['Usuarios', UsuariosController, 1],
];

describe('controllers repassam cada rota para o serviço', () => {
  it('módulo raiz carrega', () => {
    expect(AppModule).toBeDefined();
  });

  for (const [nome, Classe, nDeps] of CONTROLLERS) {
    it(nome, async () => {
      const deps = Array.from({ length: nDeps }, servicoFalso);
      const controller = new Classe(...deps);
      const metodos = Object.getOwnPropertyNames(Classe.prototype).filter(
        (m) => m !== 'constructor',
      );
      expect(metodos.length).toBeGreaterThan(0);
      for (const metodo of metodos) {
        await controller[metodo](CORINGA, CORINGA, CORINGA, CORINGA, CORINGA);
      }
      const chamadas = deps.flatMap((d: any) =>
        Object.values(d).filter((f: any) => f.mock?.calls.length),
      );
      expect(chamadas.length).toBeGreaterThan(0);
    });
  }
});
