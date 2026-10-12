import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError, timeout } from 'rxjs';

export interface Lugar {
  lat: number;
  lng: number;
  /** Calle y número, listo para el campo "Dirección". */
  direccion: string;
  /** Barrio o sector, útil para el campo "Referencia". */
  referencia: string;
}

interface RespuestaNominatim {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string>;
}

const BASE = 'https://nominatim.openstreetmap.org';
/** Mismo rectángulo de Quito que valida el API: izquierda, arriba, derecha, abajo. */
const VISTA_QUITO = '-78.80,0.20,-78.20,-0.45';
const MAX_DIRECCION = 250;
/** Servidores públicos de Overpass: si uno está saturado (504) se prueba el siguiente. */
const SERVIDORES_OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const ESPERA_MAX_OVERPASS_MS = 12000;
/** Rectángulo de Quito para Overpass: sur, oeste, norte, este. */
const CAJA_QUITO = '-0.45,-78.80,0.20,-78.20';
/** Cruces a menos de esta distancia se consideran el mismo punto (calzadas dobles, carriles). */
const AGRUPAR_CRUCES_M = 60;
const MAX_CRUCES = 4;
/** Palabras que casi siempre preceden al nombre de la calle y no están en el nombre oficial. */
const PREFIJOS_CALLE = /^(?:avenida|calle|pasaje|calzada|autopista|diagonal|transversal|via|vía|camino|boulevard|bulevar)\s+/i;
/** "Av. 10 de Agosto y Colón", "Colón e Inglaterra", "Amazonas con Naciones Unidas", "A & B"... */
const SEPARADOR_ESQUINA = /^(.+?)\s+(?:y|e|con|&|esquina)\s+(.+)$/i;

/**
 * Convierte entre coordenadas y direcciones con Nominatim (OpenStreetMap), sin clave de API.
 * Se usa desde el navegador: al marcar el mapa se rellena la dirección y al escribir una dirección
 * se ubica en el mapa. Solo se consulta por acción de la persona (clic, botón Buscar), nunca
 * mientras escribe, para respetar el límite de 1 consulta por segundo.
 *
 * Nominatim no entiende esquinas ("Colón y Amazonas"), que es como se dan las direcciones en
 * Quito: para eso se consulta Overpass (también de OpenStreetMap), que devuelve el nodo exacto
 * donde las dos calles se cruzan.
 */
@Injectable({ providedIn: 'root' })
export class GeocodificacionService {
  private readonly http = inject(HttpClient);

  /** Dirección de unas coordenadas (clic en el mapa o "usar mi ubicación"). */
  direccionDe(lat: number, lng: number): Observable<Lugar> {
    const params = new HttpParams()
      .set('format', 'jsonv2')
      .set('lat', lat)
      .set('lon', lng)
      .set('zoom', 18)
      .set('addressdetails', 1)
      .set('accept-language', 'es');
    return this.http
      .get<RespuestaNominatim>(`${BASE}/reverse`, { params })
      .pipe(map((r) => this.aLugar(r, lat, lng)));
  }

  /** Busca una dirección escrita a mano, limitada a Quito. Acepta esquinas ("Calle A y Calle B"). */
  buscar(texto: string): Observable<Lugar[]> {
    const limpio = this.normalizar(texto);
    const esquina = SEPARADOR_ESQUINA.exec(limpio);
    return esquina ? this.buscarEsquina(esquina[1], esquina[2]) : this.consultar(limpio, 5);
  }

  private consultar(texto: string, limite: number): Observable<Lugar[]> {
    const params = new HttpParams()
      .set('format', 'jsonv2')
      .set('q', `${texto}, Quito, Ecuador`)
      .set('limit', limite)
      .set('addressdetails', 1)
      .set('countrycodes', 'ec')
      .set('viewbox', VISTA_QUITO)
      .set('bounded', 1)
      .set('accept-language', 'es');
    return this.http
      .get<RespuestaNominatim[]>(`${BASE}/search`, { params })
      .pipe(map((lista) => lista.map((r) => this.aLugar(r, Number(r.lat), Number(r.lon)))));
  }

  private buscarEsquina(calleA: string, calleB: string): Observable<Lugar[]> {
    const consulta =
      `[out:json][timeout:15];` +
      `way["highway"]["name"~"${patronCalle(calleA)}",i](${CAJA_QUITO})->.a;` +
      `way["highway"]["name"~"${patronCalle(calleB)}",i](${CAJA_QUITO})->.b;` +
      `node(w.a)(w.b);out body 20;`;
    const nombre = (t: string) => t.replace(PREFIJOS_CALLE, '').trim();
    return this.overpass(consulta).pipe(
      map((r) => agrupar(r.elements ?? [])),
      map((puntos) =>
        puntos.slice(0, MAX_CRUCES).map((p) => ({
          lat: p.lat,
          lng: p.lon,
          direccion: `${etiquetaCalle(calleA, nombre(calleA))} y ${etiquetaCalle(calleB, nombre(calleB))}`.slice(0, MAX_DIRECCION),
          referencia: '',
        })),
      ),
      // Si Overpass no responde, la persona puede marcar el punto en el mapa: no es un error fatal.
      catchError(() => of([] as Lugar[])),
    );
  }

  private overpass(consulta: string): Observable<{ elements?: { lat: number; lon: number }[] }> {
    const params = new HttpParams().set('data', consulta);
    const intentar = (i: number): Observable<{ elements?: { lat: number; lon: number }[] }> =>
      this.http.get<{ elements?: { lat: number; lon: number }[] }>(SERVIDORES_OVERPASS[i], { params }).pipe(
        timeout(ESPERA_MAX_OVERPASS_MS),
        catchError((e) => (i + 1 < SERVIDORES_OVERPASS.length ? intentar(i + 1) : throwError(() => e))),
      );
    return intentar(0);
  }

  /** "Av." / "Avda." -> "Avenida" y espacios repetidos, porque así están nombradas en el mapa. */
  private normalizar(texto: string): string {
    return texto
      .trim()
      .replace(/\bav(?:da)?\.?\s+/gi, 'Avenida ')
      .replace(/\s+/g, ' ');
  }

  private aLugar(r: RespuestaNominatim, lat: number, lng: number): Lugar {
    const a = r.address ?? {};
    const calle = a['road'] ?? a['pedestrian'] ?? a['footway'] ?? a['path'] ?? '';
    const numero = a['house_number'] ?? '';
    const sector = a['neighbourhood'] ?? a['suburb'] ?? a['quarter'] ?? a['city_district'] ?? '';

    let direccion = [calle, numero].filter(Boolean).join(' ');
    if (!direccion) direccion = sector || (r.display_name ?? '').split(',').slice(0, 2).join(',').trim();
    // Si hay barrio y la dirección es solo una calle, el barrio ayuda a ubicarla.
    const referencia = sector && sector !== direccion ? sector : '';

    return { lat, lng, direccion: direccion.slice(0, MAX_DIRECCION), referencia: referencia.slice(0, MAX_DIRECCION) };
  }
}

/** Distancia aproximada en metros entre dos puntos (fórmula de haversine). */
function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nombre de la calle tal como la escribió la persona, con la primera letra de cada palabra en mayúscula. */
function etiquetaCalle(original: string, _sinPrefijo: string): string {
  return original
    .trim()
    .split(' ')
    .map((p) => (p.length > 2 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/**
 * Patrón (para la sintaxis de Overpass) que encuentra el nombre de una calle sin importar tildes ni
 * mayúsculas, y sin el "Avenida"/"Calle" delante: "Colon" encuentra "Avenida Colón".
 */
export function patronCalle(texto: string): string {
  const sinPrefijo = texto.replace(PREFIJOS_CALLE, '').trim();
  const clases: Record<string, string> = {
    a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]',
  };
  return sinPrefijo
    .replace(/[\\^$.|?*+()[\]{}"]/g, ' ')
    .split('')
    .map((c) => clases[c.toLowerCase()] ?? c)
    .join('');
}

/** Junta cruces que están a pocos metros (una avenida de dos calzadas genera 2 o 3 nodos). */
function agrupar(nodos: { lat: number; lon: number }[]): { lat: number; lon: number }[] {
  const grupos: { lat: number; lon: number }[] = [];
  for (const n of nodos) {
    if (!grupos.some((g) => distanciaMetros({ lat: g.lat, lng: g.lon }, { lat: n.lat, lng: n.lon }) < AGRUPAR_CRUCES_M)) {
      grupos.push(n);
    }
  }
  return grupos;
}
