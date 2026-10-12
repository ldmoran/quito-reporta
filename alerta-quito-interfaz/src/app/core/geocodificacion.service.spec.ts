import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GeocodificacionService } from './geocodificacion.service';

describe('GeocodificacionService', () => {
  let servicio: GeocodificacionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(GeocodificacionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('convierte unas coordenadas en calle, número y barrio', () => {
    let lugar: unknown;
    servicio.direccionDe(-0.2, -78.5).subscribe((l) => (lugar = l));

    const req = http.expectOne((r) => r.url === 'https://nominatim.openstreetmap.org/reverse');
    expect(req.request.params.get('lat')).toBe('-0.2');
    expect(req.request.params.get('lon')).toBe('-78.5');
    expect(req.request.params.get('accept-language')).toBe('es');
    req.flush({ address: { road: 'Avenida 10 de Agosto', house_number: 'N24-34', neighbourhood: 'La Mariscal' } });

    expect(lugar).toEqual({ lat: -0.2, lng: -78.5, direccion: 'Avenida 10 de Agosto N24-34', referencia: 'La Mariscal' });
  });

  it('si no hay calle usa el barrio como dirección y no lo repite en la referencia', () => {
    let lugar: { direccion: string; referencia: string } | undefined;
    servicio.direccionDe(-0.2, -78.5).subscribe((l) => (lugar = l));

    http.expectOne((r) => r.url.endsWith('/reverse')).flush({ address: { suburb: 'Iñaquito' } });

    expect(lugar?.direccion).toBe('Iñaquito');
    expect(lugar?.referencia).toBe('');
  });

  it('si no hay datos de dirección cae a los primeros tramos del nombre completo', () => {
    let lugar: { direccion: string } | undefined;
    servicio.direccionDe(-0.2, -78.5).subscribe((l) => (lugar = l));

    http.expectOne((r) => r.url.endsWith('/reverse')).flush({ display_name: 'Parque La Carolina, Quito, Pichincha, Ecuador' });

    expect(lugar?.direccion).toBe('Parque La Carolina, Quito');
  });

  it('busca una dirección limitada a Quito y devuelve los lugares encontrados', () => {
    let lugares: { lat: number; direccion: string }[] = [];
    servicio.buscar('  Parque   La Carolina ').subscribe((l) => (lugares = l));

    const req = http.expectOne((r) => r.url === 'https://nominatim.openstreetmap.org/search');
    expect(req.request.params.get('q')).toBe('Parque La Carolina, Quito, Ecuador');
    expect(req.request.params.get('bounded')).toBe('1');
    expect(req.request.params.get('countrycodes')).toBe('ec');
    expect(req.request.params.get('viewbox')).toBe('-78.80,0.20,-78.20,-0.45');
    req.flush([
      { lat: '-0.2012', lon: '-78.4987', address: { road: 'Avenida 10 de Agosto' } },
      { lat: '-0.2100', lon: '-78.5000', address: { road: 'Colón' } },
    ]);

    expect(lugares.length).toBe(2);
    expect(lugares[0].lat).toBeCloseTo(-0.2012);
    expect(lugares[1].direccion).toBe('Colón');
  });

  it('una búsqueda sin resultados devuelve una lista vacía', () => {
    let lugares: unknown[] | undefined;
    servicio.buscar('calle inexistente').subscribe((l) => (lugares = l));

    http.expectOne((r) => r.url.endsWith('/search')).flush([]);

    expect(lugares).toEqual([]);
  });

  it('recorta direcciones larguísimas a los 250 caracteres que acepta el API', () => {
    let lugar: { direccion: string } | undefined;
    servicio.direccionDe(-0.2, -78.5).subscribe((l) => (lugar = l));

    http.expectOne((r) => r.url.endsWith('/reverse')).flush({ address: { road: 'x'.repeat(400) } });

    expect(lugar?.direccion.length).toBe(250);
  });

  describe('esquinas ("Calle A y Calle B")', () => {
    const OVERPASS = (r: { url: string }) => r.url.includes('/interpreter');

    it('consulta Overpass con las dos calles y devuelve el cruce exacto', () => {
      let lugares: { lat: number; lng: number; direccion: string }[] = [];
      servicio.buscar('Av. 10 de Agosto y Colon').subscribe((l) => (lugares = l));

      const req = http.expectOne(OVERPASS);
      const consulta = req.request.params.get('data') ?? '';
      expect(consulta).toContain('["highway"]');
      expect(consulta).toContain('"10 d[eéèëê] [aáàäâ]g[oóòöô]st[oóòöô]"');   // 10 de Agosto, sin el prefijo Avenida
      expect(consulta).not.toContain('Avenida');
      expect(consulta).toContain('C[oóòöô]l[oóòöô][nñ]');   // "Colon" encuentra "Colón"
      expect(consulta).toContain('node(w.a)(w.b)');
      req.flush({ elements: [{ lat: -0.2012, lon: -78.4987 }] });

      expect(lugares.length).toBe(1);
      expect(lugares[0].lat).toBeCloseTo(-0.2012);
      expect(lugares[0].lng).toBeCloseTo(-78.4987);
      expect(lugares[0].direccion).toBe('Avenida 10 de Agosto y Colon');
    });

    it('junta los nodos de una misma esquina (calzadas dobles) y deja los cruces distintos', () => {
      let lugares: { lat: number }[] = [];
      servicio.buscar('Amazonas y Naciones Unidas').subscribe((l) => (lugares = l));

      http.expectOne(OVERPASS).flush({
        elements: [
          { lat: -0.17570, lon: -78.48560 },
          { lat: -0.17574, lon: -78.48564 },   // a ~6 m: misma esquina
          { lat: -0.19000, lon: -78.49000 },   // otro cruce, lejos
        ],
      });

      expect(lugares.length).toBe(2);
    });

    it('si un servidor de Overpass está saturado prueba con el siguiente', () => {
      let lugares: unknown[] = [];
      servicio.buscar('Amazonas y Naciones Unidas').subscribe((l) => (lugares = l));

      http.expectOne((r) => r.url.startsWith('https://overpass-api.de')).flush('', { status: 504, statusText: 'Gateway Timeout' });
      http.expectOne((r) => r.url.startsWith('https://overpass.kumi.systems')).flush({ elements: [{ lat: -0.1757, lon: -78.4856 }] });

      expect(lugares.length).toBe(1);
    });

    it('si todos los servidores fallan no rompe: devuelve vacío para que marque en el mapa', () => {
      let lugares: unknown[] | undefined;
      servicio.buscar('Amazonas y Naciones Unidas').subscribe((l) => (lugares = l));

      for (const servidor of ['overpass-api.de', 'overpass.kumi.systems', 'maps.mail.ru']) {
        http.expectOne((r) => r.url.includes(servidor)).flush('', { status: 504, statusText: 'Gateway Timeout' });
      }

      expect(lugares).toEqual([]);
    });

    it('si las calles no se cruzan devuelve vacío', () => {
      let lugares: unknown[] | undefined;
      servicio.buscar('Amazonas y Naciones Unidas').subscribe((l) => (lugares = l));

      http.expectOne(OVERPASS).flush({ elements: [] });

      expect(lugares).toEqual([]);
    });

    it('una dirección sin esquina se busca tal cual en Nominatim (con Av. expandido)', () => {
      servicio.buscar('Av. Amazonas').subscribe();

      expect(http.expectOne((r) => r.url.endsWith('/search')).request.params.get('q')).toBe('Avenida Amazonas, Quito, Ecuador');
    });
  });
});
