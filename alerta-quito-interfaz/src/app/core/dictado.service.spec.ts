import { TestBed } from '@angular/core/testing';
import { DictadoService, EventoResultadoVoz, FABRICA_RECONOCEDOR, ReconocedorVoz } from './dictado.service';

class ReconocedorFalso implements ReconocedorVoz {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: EventoResultadoVoz) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  iniciado = false;
  falloAlIniciar = false;

  start(): void {
    if (this.falloAlIniciar) throw new Error('ya iniciado');
    this.iniciado = true;
  }
  stop(): void {
    this.iniciado = false;
    this.onend?.();
  }
  abort(): void {
    this.stop();
  }

  /** Simula lo que entrega el navegador: [{ texto, final }]. */
  decir(...frases: { texto: string; final: boolean }[]): void {
    const results = frases.map((f) => Object.assign([{ transcript: f.texto }], { isFinal: f.final }));
    this.onresult?.({ resultIndex: 0, results } as unknown as EventoResultadoVoz);
  }
}

function configurar(reconocedor: ReconocedorFalso | null): DictadoService {
  TestBed.configureTestingModule({
    providers: [{ provide: FABRICA_RECONOCEDOR, useValue: reconocedor ? () => reconocedor : null }],
  });
  return TestBed.inject(DictadoService);
}

describe('DictadoService', () => {
  it('avisa cuando el navegador no soporta el dictado', () => {
    const servicio = configurar(null);

    expect(servicio.disponible).toBeFalse();
    expect(servicio.iniciar({ alTexto: () => undefined, alTerminar: () => undefined })).toBeNull();
  });

  it('configura español de Ecuador, continuo y con resultados provisionales', () => {
    const falso = new ReconocedorFalso();
    configurar(falso).iniciar({ alTexto: () => undefined, alTerminar: () => undefined });

    expect(falso.lang).toBe('es-EC');
    expect(falso.continuous).toBeTrue();
    expect(falso.interimResults).toBeTrue();
    expect(falso.iniciado).toBeTrue();
  });

  it('separa el texto confirmado del provisional', () => {
    const falso = new ReconocedorFalso();
    const recibido: [string, string][] = [];
    configurar(falso).iniciar({ alTexto: (c, p) => recibido.push([c, p]), alTerminar: () => undefined });

    falso.decir({ texto: 'hay un accidente', final: true }, { texto: 'en la avenida', final: false });

    expect(recibido[0]).toEqual(['hay un accidente', 'en la avenida']);
  });

  it('detener termina sin error', () => {
    const falso = new ReconocedorFalso();
    const terminos: (string | undefined)[] = [];
    const sesion = configurar(falso).iniciar({ alTexto: () => undefined, alTerminar: (e) => terminos.push(e) });

    sesion!.detener();

    expect(terminos).toEqual([undefined]);
  });

  it('traduce el permiso de micrófono denegado a un mensaje claro y termina una sola vez', () => {
    const falso = new ReconocedorFalso();
    const terminos: (string | undefined)[] = [];
    configurar(falso).iniciar({ alTexto: () => undefined, alTerminar: (e) => terminos.push(e) });

    falso.onerror?.({ error: 'not-allowed' });
    falso.onend?.();

    expect(terminos.length).toBe(1);
    expect(terminos[0]).toContain('Permiso de micrófono denegado');
  });

  it('"no-speech" (nadie habló) no es un error para la persona', () => {
    const falso = new ReconocedorFalso();
    const terminos: (string | undefined)[] = [];
    configurar(falso).iniciar({ alTexto: () => undefined, alTerminar: (e) => terminos.push(e) });

    falso.onerror?.({ error: 'no-speech' });

    expect(terminos).toEqual([undefined]);
  });

  it('si el navegador no deja iniciar, informa y no devuelve sesión', () => {
    const falso = new ReconocedorFalso();
    falso.falloAlIniciar = true;
    const terminos: (string | undefined)[] = [];

    const sesion = configurar(falso).iniciar({ alTexto: () => undefined, alTerminar: (e) => terminos.push(e) });

    expect(sesion).toBeNull();
    expect(terminos[0]).toContain('No se pudo iniciar');
  });
});
