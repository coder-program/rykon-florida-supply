import {
  CalendarClock,
  ClipboardCheck,
  Handshake,
  MapPin,
  MessageCircle,
  PackageCheck,
  Repeat,
  ScanSearch,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  SprayCan,
  Store,
  Tractor,
  Truck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import confeitarias from '../assets/img/confeitarias.jpg'
import padarias from '../assets/img/padarias.jpg'
import sorveterias from '../assets/img/sorveterias.jpg'
import restaurantes from '../assets/img/restaurantes.jpg'
import foodService from '../assets/img/food-service.jpg'
import revendas from '../assets/img/revendas.jpg'
import morangos from '../assets/img/morangos.jpg'
import hidroponico from '../assets/img/hidroponico.jpg'
import fazenda from '../assets/img/fazenda-mg.jpg'
import premium from '../assets/img/morango-premium.jpg'

export const NAV = [
  { href: '#quem-somos', label: 'Quem Somos' },
  { href: '#para-quem', label: 'Para Quem' },
  { href: '#produtos', label: 'Produtos' },
  { href: '#plataforma', label: 'Plataforma' },
  { href: '#entregas', label: 'Entregas' },
  { href: '#contato', label: 'Contato' },
]

export const PERFIS: { id: string; nome: string; descricao: string; icon: LucideIcon }[] = [
  {
    id: 'admin',
    nome: 'Administrador',
    descricao: 'Gestão, estoque, financeiro e relatórios',
    icon: ShieldCheck,
  },
  {
    id: 'vendedor',
    nome: 'Vendedor',
    descricao: 'Pedidos na rua e carteira de clientes',
    icon: ShoppingBasket,
  },
  { id: 'motorista', nome: 'Motorista', descricao: 'Rotas e confirmação de entregas', icon: Truck },
  { id: 'cliente', nome: 'Cliente', descricao: 'Meus pedidos, entregas e histórico', icon: Store },
]

export const DIFERENCIAIS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: Tractor,
    titulo: 'Direto da fazenda',
    texto:
      'Parceria com produtor em Minas Gerais. Morango com origem conhecida e colheita controlada.',
  },
  {
    icon: CalendarClock,
    titulo: 'Entrega combinada',
    texto: 'Cada cliente tem seu dia, horário e frequência definidos conforme sua operação.',
  },
  {
    icon: Sprout,
    titulo: 'Linhas para cada uso',
    texto:
      'Do morango grande para confeitaria ao hidropônico premium. Temos o ideal para cada aplicação.',
  },
  {
    icon: Handshake,
    titulo: 'Atendimento próximo',
    texto: 'Você fala com quem entende do produto e resolve na hora. Sem burocracia.',
  },
]

export const SEGMENTOS = [
  {
    titulo: 'Confeitarias',
    texto:
      'Morangos selecionados para decorações, mousses, bolos e o clássico morango do amor. Tamanho e aparência que fazem diferença.',
    img: confeitarias,
  },
  {
    titulo: 'Padarias',
    texto:
      'Da vitrine ao recheio: morango fresco que valoriza cada produto e conquista o cliente no balcão.',
    img: padarias,
  },
  {
    titulo: 'Sorveterias',
    texto:
      'Polpa e fruta in natura para sorbet, gelato e cobertura. Qualidade consistente para produção diária.',
    img: sorveterias,
  },
  {
    titulo: 'Restaurantes e Cantinas',
    texto:
      'Frescor garantido para sobremesas, saladas de frutas e pratos que precisam de ingredientes de primeira.',
    img: restaurantes,
  },
  {
    titulo: 'Food Service',
    texto:
      'Fornecimento em volume com logística confiável para cozinhas industriais e operações de grande escala.',
    img: foodService,
  },
  {
    titulo: 'Revendas',
    texto:
      'Morango com procedência para revender com segurança e margens atrativas para feiras e mercados.',
    img: revendas,
  },
]

export type Linha = 'Convencional' | 'Hidropônico' | 'Semi Hidropônico' | 'Premium'

export const PRODUTOS: {
  nome: string
  tag: string
  tagClass: string
  linha: Linha
  texto: string
  img: string
}[] = [
  {
    nome: 'Morango B2',
    tag: 'Grande',
    tagClass: 'bg-forest-800',
    linha: 'Convencional',
    texto:
      'Tamanho grande, ideal para morango do amor, confeitaria e presenteação. Alto apelo visual.',
    img: morangos,
  },
  {
    nome: 'Morango B3',
    tag: 'Médio',
    tagClass: 'bg-olive',
    linha: 'Convencional',
    texto: 'Tamanho médio, versátil para uso geral em recheios, sobremesas e polpas.',
    img: morangos,
  },
  {
    nome: 'Morango Comum',
    tag: 'Econômico',
    tagClass: 'bg-neutral-600',
    linha: 'Convencional',
    texto: 'Opção econômica para processamento, polpa, geleia e produções em grande escala.',
    img: morangos,
  },
  {
    nome: 'B2 Hidropônico',
    tag: 'Premium',
    tagClass: 'bg-wine',
    linha: 'Hidropônico',
    texto:
      'Cultivado sem solo, mais uniforme e sem resíduo de terra. B2 grande para confeitaria de alto padrão.',
    img: hidroponico,
  },
  {
    nome: 'B3 Hidropônico',
    tag: 'Premium',
    tagClass: 'bg-wine',
    linha: 'Hidropônico',
    texto: 'Tamanho médio hidropônico. Sabor equilibrado, ótimo para sobremesas e sorvetes.',
    img: hidroponico,
  },
  {
    nome: 'B2 Semi Hidropônico',
    tag: 'Especial',
    tagClass: 'bg-lime',
    linha: 'Semi Hidropônico',
    texto:
      'Combinação entre cultivo tradicional e hidropônico. Grande, bonito e com sabor acentuado.',
    img: fazenda,
  },
  {
    nome: 'B3 Semi Hidropônico',
    tag: 'Especial',
    tagClass: 'bg-lime',
    linha: 'Semi Hidropônico',
    texto: 'Médio com as vantagens do semi hidropônico: uniformidade e custo-benefício.',
    img: fazenda,
  },
  {
    nome: 'Premium',
    tag: 'Top',
    tagClass: 'bg-ember',
    linha: 'Premium',
    texto: 'Selecionado por tamanho e doçura. Bandeja 100% aproveitável, zero desperdício.',
    img: premium,
  },
]

export const LINHAS: ('Todos' | Linha)[] = [
  'Todos',
  'Convencional',
  'Hidropônico',
  'Semi Hidropônico',
  'Premium',
]

export const ETAPAS: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: Sprout,
    titulo: 'Seleção na origem',
    texto:
      'Morangos escolhidos diretamente na fazenda parceira em Minas Gerais, antes do carregamento.',
  },
  {
    icon: ScanSearch,
    titulo: 'Inspeção no recebimento',
    texto: 'Todo lote passa por inspeção rigorosa ao chegar no nosso CD em Barueri.',
  },
  {
    icon: PackageCheck,
    titulo: 'Carregamento cuidadoso',
    texto: 'Organização pensada para evitar amassados e garantir que cada caixinha chegue intacta.',
  },
  {
    icon: SprayCan,
    titulo: 'Veículos higienizados',
    texto:
      'Frota limpa e preparada para transporte de hortifruti, mantendo as condições do produto.',
  },
  {
    icon: UserRound,
    titulo: 'Motoristas preparados',
    texto: 'Equipe treinada para o manuseio correto e pontualidade nas entregas.',
  },
  {
    icon: ClipboardCheck,
    titulo: 'Entrega conferida',
    texto: 'O cliente recebe e confere na hora. Qualquer problema, resolvemos de imediato.',
  },
]

export const ENTREGA_ITENS: { icon: LucideIcon; texto: string }[] = [
  { icon: CalendarClock, texto: 'Dia e horário definidos com você' },
  { icon: MapPin, texto: 'Entrega no endereço da sua operação' },
  { icon: Repeat, texto: 'Frequência semanal, quinzenal ou sob demanda' },
  { icon: MessageCircle, texto: 'Comunicação direta via WhatsApp' },
]

export const DEPOIMENTOS = [
  {
    texto:
      'Trabalhamos com a Florida há 6 meses e a qualidade do morango é consistente. Nunca tivemos problema com entrega fora do horário combinado.',
    nome: 'Maria Clara',
    empresa: 'Confeitaria Doce Arte',
  },
  {
    texto:
      'O atendimento é muito próximo. Qualquer necessidade, resolvem na hora pelo WhatsApp. Morango fresco e bonito que valoriza nossa vitrine.',
    nome: 'João Paulo',
    empresa: 'Padaria Sabor do Bairro',
  },
  {
    texto:
      'Usamos o hidropônico para o sorbet e a diferença é nítida. Produto uniforme, sem desperdício e com sabor que agrada nossos clientes.',
    nome: 'Fernanda Lima',
    empresa: 'Sorveteria Gelato Fino',
  },
]

export const FAQ = [
  {
    q: 'Qual a diferença entre B2 e B3?',
    a: 'A classificação indica o tamanho do morango. O B2 é o morango grande, ideal para decoração, morango do amor e presenteação. O B3 é o tamanho médio, mais versátil para recheios, sobremesas e polpas.',
  },
  {
    q: 'Qual a diferença entre o morango comum, semi hidropônico e hidropônico?',
    a: 'O comum é cultivado no solo e é a opção mais econômica. O semi hidropônico usa substrato com irrigação controlada, com boa uniformidade e sabor acentuado. O hidropônico é cultivado 100% em água com nutrientes, sem solo, com máxima uniformidade e zero resíduo de terra.',
  },
  {
    q: 'Vocês entregam em qual região?',
    a: 'Nosso centro de distribuição fica no Jardim Aldir, em Barueri (SP). Atendemos Barueri, Alphaville e a Grande São Paulo. Fale com a gente pelo WhatsApp para confirmar o atendimento no seu endereço.',
  },
  {
    q: 'Como faço meu primeiro pedido?',
    a: 'É só chamar no WhatsApp ou preencher o formulário de cotação. Entendemos sua necessidade, enviamos a cotação e combinamos dia, horário e frequência de entrega. Depois disso, você acompanha seus pedidos pela nossa plataforma.',
  },
  {
    q: 'Qual é a frequência de entrega?',
    a: 'Você escolhe: semanal, quinzenal, em dias fixos da semana ou sob demanda. Organizamos a logística conforme a rotina da sua operação.',
  },
  {
    q: 'Cada caixa contém quantas caixinhas?',
    a: 'Cada caixa contém 4 caixinhas, em todas as linhas de produto.',
  },
  {
    q: 'Os preços são fixos ou sob consulta?',
    a: 'Os valores são sob consulta. Trabalhamos com cotações personalizadas, que levam em conta o produto, o volume e a frequência de cada cliente.',
  },
]

export const SEGMENTOS_FORM = [
  'Confeitaria',
  'Padaria',
  'Sorveteria',
  'Restaurante / Cantina',
  'Food Service',
  'Revenda',
  'Outro',
]
