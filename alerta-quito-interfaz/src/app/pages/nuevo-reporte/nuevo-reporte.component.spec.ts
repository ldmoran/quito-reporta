import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EventoResultadoVoz, FABRICA_RECONOCEDOR, ReconocedorVoz } from '../../core/dictado.service';
import { NuevoReporteComponent } from './nuevo-reporte.component';

class ReconocedorFalso implements ReconocedorVoz {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: EventoResultadoVoz) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start(): void {}
  stop(): void {
    this.onend?.();
  }
  abort(): void {}
  decir(texto: string, final: boolean): void {
    const results = [Object.assign([{ transcript: texto }], { isFinal: final })];
    this.onresult?.({ resultIndex: 0, results } as unknown as EventoResultadoVoz);
  }
}

describe('NuevoReporteComponent: dirección automática y dictado', () => {
  let fixture: ComponentFixture<NuevoReporteComponent>;
  let componente: NuevoReporteComponent;
  let http: HttpTestingController;
  let voz: ReconocedorFalso;

  beforeEach(async () => {
    voz = new ReconocedorFalso();
    await TestBed.configureTestingModule({
      imports: [NuevoReporteComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FABRICA_RECONOCEDOR, useValue: () => voz },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NuevoReporteComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/tipos-incidente').flush([]);
  });

  afterEach(() => http.verify());

  const reverso = () => http.expectOne((r) => r.url.endsWith('/reverse'));

  it('al marcar el mapa rellena la dirección y la referencia', () => {
    componente.elegirUbicacion({ lat: -0.2012, lng: -78.4987 });
    reverso().flush({ address: { road: 'Avenida 10 de Agosto', house_number: 'N24-34', neighbourhood: 'La Mariscal' } });

    expect(componente.direccion).toBe('Avenida 10 de Agosto N24-34');
    expect(componente.referencia).toBe('La Mariscal');
    expect(componente.avisoUbicacion()).toContain('completada automáticamente');
  });

  it('no pisa lo que la persona ya escribió', () => {
    componente.alEscribirDireccion('Mi calle exacta');
    componente.referencia = 'Frente a mi casa';
    componente.referenciaEditada = true;

    componente.elegirUbicacion({ lat: -0.2012, lng: -78.4987 });
    reverso().flush({ address: { road: 'Otra calle', neighbourhood: 'Otro barrio' } });

    expect(componente.direccion).toBe('Mi calle exacta');
    expect(componente.referencia).toBe('Frente a mi casa');
  });

  it('una ubicación fuera de Quito se rechaza y no consulta nada', () => {
    componente.elegirUbicacion({ lat: 40.4168, lng: -3.7038 });

    expect(componente.ubicacion()).toBeNull();
    expect(componente.error()).toContain('dentro de Quito');
  });

  it('si el servicio de direcciones falla, avisa y deja escribir a mano', () => {
    componente.elegirUbicacion({ lat: -0.2, lng: -78.5 });
    reverso().flush('error', { status: 503, statusText: 'No disponible' });

    expect(componente.ubicacion()).not.toBeNull();
    expect(componente.avisoUbicacion()).toContain('Escríbala usted');
  });

  it('al buscar una dirección con un solo resultado la ubica en el mapa', () => {
    componente.alEscribirDireccion('Parque La Carolina');
    componente.buscarDireccion();
    http.expectOne((r) => r.url.endsWith('/search')).flush([
      { lat: '-0.2012', lon: '-78.4987', address: { road: 'Avenida 10 de Agosto', neighbourhood: 'La Mariscal' } },
    ]);

    expect(componente.ubicacion()).toEqual({ lat: -0.2012, lng: -78.4987 });
    expect(componente.direccion).toBe('Avenida 10 de Agosto');
    expect(componente.referencia).toBe('La Mariscal');
    expect(componente.sugerencias().length).toBe(0);
  });

  it('con varios resultados ofrece una lista para elegir', () => {
    componente.alEscribirDireccion('Colón');
    componente.buscarDireccion();
    http.expectOne((r) => r.url.endsWith('/search')).flush([
      { lat: '-0.2', lon: '-78.5', address: { road: 'Avenida Colón' } },
      { lat: '-0.21', lon: '-78.51', address: { road: 'Colón y Reina Victoria' } },
    ]);

    expect(componente.sugerencias().length).toBe(2);
    expect(componente.ubicacion()).toBeNull();

    componente.elegirSugerencia(componente.sugerencias()[1]);
    expect(componente.ubicacion()).toEqual({ lat: -0.21, lng: -78.51 });
    expect(componente.direccion).toBe('Colón y Reina Victoria');
  });

  it('si no encuentra la dirección lo dice', () => {
    componente.alEscribirDireccion('xyz');
    componente.buscarDireccion();
    http.expectOne((r) => r.url.endsWith('/search')).flush([]);

    expect(componente.avisoUbicacion()).toContain('No se encontró');
  });

  it('el dictado escribe lo que se habla en el detalle, con mayúscula inicial', () => {
    componente.alternarDictado();
    expect(componente.dictando()).toBeTrue();

    voz.decir('hay un accidente en la avenida', true);

    expect(componente.descripcion).toBe('Hay un accidente en la avenida');
  });

  it('el dictado agrega al texto que ya estaba escrito y respeta el máximo de 500 caracteres', () => {
    componente.descripcion = 'Dos autos chocaron.';
    componente.alternarDictado();
    voz.decir('hay heridos', true);
    expect(componente.descripcion).toBe('Dos autos chocaron. hay heridos');

    componente.alternarDictado();   // detener
    componente.descripcion = '';
    componente.alternarDictado();
    voz.decir('a'.repeat(700), true);
    expect(componente.descripcion.length).toBe(500);
  });

  it('al detener el dictado vuelve al estado normal', () => {
    componente.alternarDictado();
    componente.alternarDictado();

    expect(componente.dictando()).toBeFalse();
  });

  it('muestra un mensaje claro si se niega el permiso del micrófono', () => {
    componente.alternarDictado();
    voz.onerror?.({ error: 'not-allowed' });

    expect(componente.dictando()).toBeFalse();
    expect(componente.errorDictado()).toContain('Permiso de micrófono denegado');
  });
});
