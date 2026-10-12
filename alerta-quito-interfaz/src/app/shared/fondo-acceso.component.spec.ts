import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FondoAccesoComponent } from './fondo-acceso.component';

/** GIF de 1x1 píxel: una "foto" que sí carga sin depender de archivos. */
const FOTO_OK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const FOTO_ROTA = 'data:image/jpeg;base64,esto-no-es-una-imagen';

@Component({
  standalone: true,
  imports: [FondoAccesoComponent],
  template: `<app-fondo-acceso [imagenes]="imagenes" [respaldo]="respaldo" [intervaloMs]="intervalo"><p id="contenido">Formulario</p></app-fondo-acceso>`,
})
class AnfitrionComponent {
  imagenes: string[] = [];
  respaldo: string[] = [];
  intervalo = 50;
}

describe('FondoAccesoComponent', () => {
  let fixture: ComponentFixture<AnfitrionComponent>;

  async function montar(imagenes: string[], respaldo: string[] = [], intervalo = 60_000): Promise<HTMLElement> {
    fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.componentInstance.imagenes = imagenes;
    fixture.componentInstance.respaldo = respaldo;
    fixture.componentInstance.intervalo = intervalo;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 80));   // deja terminar la precarga
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionComponent] }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  it('muestra el formulario dentro del panel y el logo', async () => {
    const html = await montar([FOTO_OK]);

    expect(html.querySelector('.login-panel #contenido')?.textContent).toBe('Formulario');
    expect(html.querySelector('.login-brand img.logo')).not.toBeNull();
  });

  it('usa solo las fotos que existen y se salta las que faltan', async () => {
    const html = await montar([FOTO_OK, FOTO_ROTA, FOTO_OK + '#segunda']);

    expect(html.querySelectorAll('.login-slide').length).toBe(2);
  });

  it('si no carga ninguna foto usa las de respaldo', async () => {
    const html = await montar([FOTO_ROTA], [FOTO_OK]);

    expect(html.querySelectorAll('.login-slide').length).toBe(1);
  });

  it('con varias fotos va cambiando la imagen activa', async () => {
    const html = await montar([FOTO_OK, FOTO_OK + '#b'], [], 200);
    const activas = () => Array.from(html.querySelectorAll('.login-slide')).map((s) => s.classList.contains('activa'));

    expect(activas()).toEqual([true, false]);   // arranca por la primera (el intervalo es mayor que la espera de montar)
    await new Promise((r) => setTimeout(r, 260));
    fixture.detectChanges();
    expect(activas()).toEqual([false, true]);
  });
});
