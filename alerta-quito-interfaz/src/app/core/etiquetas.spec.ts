import { estaEnQuito } from '../shared/mapa.component';
import { ETIQUETA_ESTADO, SIGUIENTES_ESTADOS, etiquetaEstado, iconoTipo } from './etiquetas';
import { mensajeDeError } from './mensajes';
import { HttpErrorResponse } from '@angular/common/http';

describe('etiquetas', () => {
  it('traduce los estados', () => {
    expect(etiquetaEstado('EN_ATENCION')).toBe('En atención');
    expect(etiquetaEstado('DESCONOCIDO')).toBe('DESCONOCIDO');
    expect(Object.keys(ETIQUETA_ESTADO).length).toBe(5);
  });

  it('un caso cerrado no tiene siguientes estados y resolver exige estar en atención', () => {
    expect(SIGUIENTES_ESTADOS.RESUELTO).toEqual([]);
    expect(SIGUIENTES_ESTADOS.RECHAZADO).toEqual([]);
    expect(SIGUIENTES_ESTADOS.EN_ATENCION).toEqual(['RESUELTO']);
    expect(SIGUIENTES_ESTADOS.REGISTRADO).not.toContain('RESUELTO');
  });

  it('elige un icono por tipo de incidente', () => {
    expect(iconoTipo('Bache')).toBe('🕳️');
    expect(iconoTipo('Robo o asalto')).toBe('🚨');
    expect(iconoTipo('Algo nuevo')).toBe('⚠️');
  });
});

describe('estaEnQuito', () => {
  it('acepta puntos del centro y rechaza otras ciudades', () => {
    expect(estaEnQuito(-0.1807, -78.4678)).toBeTrue();
    expect(estaEnQuito(-2.1894, -79.8891)).toBeFalse(); // Guayaquil
    expect(estaEnQuito(40.4168, -3.7038)).toBeFalse(); // Madrid
  });
});

describe('mensajeDeError', () => {
  it('usa el mensaje del servidor cuando existe', () => {
    const e = new HttpErrorResponse({ status: 400, error: { mensaje: 'La foto es obligatoria.' } });
    expect(mensajeDeError(e)).toBe('La foto es obligatoria.');
  });

  it('distingue servidor caído, sin permisos y foto muy grande', () => {
    expect(mensajeDeError(new HttpErrorResponse({ status: 0 }))).toContain('conexión');
    expect(mensajeDeError(new HttpErrorResponse({ status: 403 }))).toContain('permisos');
    expect(mensajeDeError(new HttpErrorResponse({ status: 413 }))).toContain('5 MB');
    expect(mensajeDeError(new Error('x'))).toContain('inesperado');
  });
});
