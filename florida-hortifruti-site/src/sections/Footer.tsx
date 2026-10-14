import { ArrowUp } from 'lucide-react'
import { NAV } from '../data/content'
import { useAccess } from '../lib/access'
import { EMAIL, INSTAGRAM, whatsappLink, WHATSAPP_LABEL } from '../lib/config'
import { Brand } from '../components/Header'

export function Footer() {
  const { open } = useAccess()

  return (
    <footer className="relative overflow-hidden bg-forest-950 text-cream/55">
      <div className="container-site grid gap-12 pt-20 pb-14 md:grid-cols-[1.6fr_1fr_1.2fr]">
        <div>
          <Brand subtitle="DISTRIBUIDORA B2B DE MORANGOS" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed">
            Morango fresco com procedência, do campo à produção do seu negócio.
          </p>
          <a
            href={`https://instagram.com/${INSTAGRAM}`}
            target="_blank"
            rel="noopener"
            className="mt-5 inline-block text-sm font-semibold text-cream hover:text-ember"
          >
            @{INSTAGRAM}
          </a>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold tracking-[0.24em] text-white uppercase">
            Navegação
          </h4>
          <ul className="mt-6 grid gap-3 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="transition-colors hover:text-ember">
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#faq" className="transition-colors hover:text-ember">
                FAQ
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={open}
                className="font-semibold text-cream transition-colors hover:text-ember"
              >
                Acessar sistema →
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold tracking-[0.24em] text-white uppercase">
            Contato
          </h4>
          <ul className="mt-6 grid gap-3 text-sm">
            <li>
              <a href={whatsappLink()} target="_blank" rel="noopener" className="hover:text-ember">
                {WHATSAPP_LABEL}
              </a>
            </li>
            <li>
              <a href={`mailto:${EMAIL}`} className="hover:text-ember">
                {EMAIL}
              </a>
            </li>
            <li>
              Jardim Aldir, Barueri – SP
              <br />
              <span className="text-xs text-cream/40">Escritório: Alphaville</span>
            </li>
          </ul>
        </div>
      </div>

      {/* assinatura gigante */}
      <div className="container-site relative select-none" aria-hidden="true">
        <p className="bg-gradient-to-b from-cream/12 to-transparent bg-clip-text text-center text-[13vw] leading-[0.85] font-bold tracking-[-0.05em] whitespace-nowrap text-transparent xl:text-[180px]">
          Florida Supply
        </p>
      </div>

      <div className="border-t border-white/6">
        <div className="container-site flex flex-col items-center justify-between gap-4 py-6 text-xs text-cream/40 md:flex-row">
          <span>
            <strong className="text-cream/60">FLORIDA HORTIFRUTI LTDA</strong> · CNPJ
            50.295.992/0001-08
          </span>
          <span>
            © {new Date().getFullYear()} Florida Supply Hortifruti. Todos os direitos reservados.
          </span>
          <a href="#topo" className="flex items-center gap-2 transition-colors hover:text-ember">
            Voltar ao topo <ArrowUp className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  )
}
