import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

type EnderecoGeo = {
  id: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodificadoEm: Date | null;
  cidade?: { nome: string; estado?: { sigla: string } | null } | null;
};

// Endereço sem ponto só é tentado de novo depois disso (evita bater no serviço toda hora)
const NOVA_TENTATIVA_MS = 7 * 24 * 60 * 60 * 1000;
// Nominatim (OpenStreetMap) pede no máximo 1 consulta por segundo
const INTERVALO_MS = 1100;

/**
 * Converte endereço em ponto no mapa com o Nominatim (OpenStreetMap, gratuito) e guarda no
 * próprio endereço. Pode errar em endereço pequeno ou rural; nesse caso fica sem ponto.
 */
@Injectable()
export class GeocodificacaoService {
  private readonly logger = new Logger(GeocodificacaoService.name);
  private fila: Promise<unknown> = Promise.resolve();
  private ultimaConsulta = 0;
  private emAndamento = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private precisaTentar(e: EnderecoGeo) {
    if (e.latitude != null && e.longitude != null) return false;
    if (!e.geocodificadoEm) return true;
    return Date.now() - e.geocodificadoEm.getTime() > NOVA_TENTATIVA_MS;
  }

  /**
   * Agenda em segundo plano os endereços sem ponto (até `limite` por chamada). Quem chamou
   * responde na hora com o que já tem; o ponto aparece nas próximas consultas.
   */
  agendar(enderecos: EnderecoGeo[], limite = 5) {
    const pendentes = enderecos
      .filter((e) => this.precisaTentar(e) && !this.emAndamento.has(e.id))
      .slice(0, limite);
    for (const endereco of pendentes) {
      this.emAndamento.add(endereco.id);
      void this.enfileirar(() => this.buscar(endereco))
        .then((ponto) =>
          this.prisma.endereco.update({
            where: { id: endereco.id },
            data: {
              latitude: ponto?.lat ?? null,
              longitude: ponto?.lng ?? null,
              geocodificadoEm: new Date(),
            },
          }),
        )
        .catch((erro) => this.logger.warn(`Endereço ${endereco.id}: ${(erro as Error).message}`))
        .finally(() => this.emAndamento.delete(endereco.id));
    }
  }

  private enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
    const proxima = this.fila.then(async () => {
      const espera = this.ultimaConsulta + INTERVALO_MS - Date.now();
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));
      this.ultimaConsulta = Date.now();
      return tarefa();
    });
    this.fila = proxima.catch(() => undefined);
    return proxima;
  }

  // Tenta o endereço completo e, se não achar, só rua + cidade
  private async buscar(e: EnderecoGeo) {
    const cidade = e.cidade?.nome ?? '';
    const uf = e.cidade?.estado?.sigla ?? '';
    const tentativas = [
      [e.logradouro, e.numero, e.bairro, cidade, uf, e.cep].filter(Boolean).join(', '),
      [e.logradouro, cidade, uf].filter(Boolean).join(', '),
    ];
    for (const [indice, q] of tentativas.entries()) {
      if (indice > 0) await new Promise((r) => setTimeout(r, INTERVALO_MS));
      const ponto = await this.consultar(q);
      if (ponto) return ponto;
    }
    return null;
  }

  private async consultar(q: string): Promise<{ lat: number; lng: number } | null> {
    const base =
      this.config.get<string>('GEOCODER_URL') ?? 'https://nominatim.openstreetmap.org/search';
    const url = `${base}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    try {
      const resposta = await fetch(url, {
        headers: {
          'User-Agent':
            this.config.get<string>('GEOCODER_USER_AGENT') ??
            'FloridaSupply/1.0 (acompanhamento de entregas)',
          'Accept-Language': 'pt-BR',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!resposta.ok) {
        this.logger.warn(`Geocodificação respondeu ${resposta.status} para "${q}"`);
        return null;
      }
      const dados = (await resposta.json()) as { lat: string; lon: string }[];
      const primeiro = dados[0];
      if (!primeiro) return null;
      const lat = Number(primeiro.lat);
      const lng = Number(primeiro.lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    } catch (erro) {
      this.logger.warn(`Falha ao geocodificar "${q}": ${(erro as Error).message}`);
      return null;
    }
  }
}
