import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { perfilGuard, sesionGuard } from './auth.guard';
import { Perfil } from './modelos';

function sesion(perfiles: Perfil[], debeCambiar = false): void {
  sessionStorage.setItem(
    'alerta-quito.sesion',
    JSON.stringify({
      idUsuario: 1, usuario: 'u', nombre: 'U', perfiles, token: 't', venceEn: Date.now() + 60_000,
      debeCambiarPassword: debeCambiar,
    }),
  );
}

function ejecutar(guard: ReturnType<typeof perfilGuard>): boolean | UrlTree {
  const inyector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(inyector, () =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  ) as boolean | UrlTree;
}

describe('guards', () => {
  const preparar = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  };
  const ruta = (r: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(r as UrlTree);

  beforeEach(() => sessionStorage.clear());

  it('sin sesión manda al login', () => {
    preparar();
    expect(ruta(ejecutar(perfilGuard('CIUDAD')))).toBe('/login');
    expect(ruta(ejecutar(sesionGuard))).toBe('/login');
  });

  it('deja pasar al perfil correcto', () => {
    sesion(['FUNCIO']);
    preparar();
    expect(ejecutar(perfilGuard('FUNCIO'))).toBeTrue();
  });

  it('un ciudadano no entra al panel del funcionario ni al de administración', () => {
    sesion(['CIUDAD']);
    preparar();
    expect(ruta(ejecutar(perfilGuard('FUNCIO')))).toBe('/mis-reportes');
    expect(ruta(ejecutar(perfilGuard('ADMINI')))).toBe('/mis-reportes');
  });

  it('con clave temporal no se entra a nada hasta cambiarla', () => {
    sesion(['FUNCIO'], true);
    preparar();
    expect(ruta(ejecutar(perfilGuard('FUNCIO')))).toBe('/cambiar-password');
    expect(ejecutar(sesionGuard)).toBeTrue();   // la pantalla de cambio sí está permitida
  });
});
