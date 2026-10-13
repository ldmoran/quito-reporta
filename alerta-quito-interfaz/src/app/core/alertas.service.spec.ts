import { TestBed } from '@angular/core/testing';
import Swal from 'sweetalert2';
import { AlertasService, escaparHtml } from './alertas.service';

const esperar = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const campo = (nombre: string) => document.getElementById(`aq-campo-${nombre}`) as HTMLInputElement & HTMLSelectElement;

describe('AlertasService (SweetAlert2)', () => {
  let servicio: AlertasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(AlertasService);
  });

  afterEach(() => Swal.close());

  it('escaparHtml neutraliza etiquetas y comillas', () => {
    expect(escaparHtml('<b>"a" & \'b\'</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
    expect(escaparHtml(null)).toBe('');
    expect(escaparHtml(5)).toBe('5');
  });

  describe('confirmar', () => {
    it('devuelve true al aceptar y false al cancelar', async () => {
      let r = servicio.confirmar({ titulo: '¿Seguro?', boton: 'Sí' });
      await esperar();
      expect(Swal.getTitle()?.textContent).toBe('¿Seguro?');
      expect(Swal.getConfirmButton()?.textContent).toBe('Sí');
      Swal.clickConfirm();
      expect(await r).toBeTrue();

      r = servicio.confirmar({ titulo: '¿Seguro?' });
      await esperar();
      Swal.clickCancel();
      expect(await r).toBeFalse();
    });

    it('una acción de peligro enfoca "Cancelar" para evitar confirmar sin querer', async () => {
      const r = servicio.confirmar({ titulo: 'Dar de baja', peligro: true });
      await esperar();

      expect(document.activeElement).toBe(Swal.getCancelButton());
      Swal.clickCancel();
      await r;
    });
  });

  describe('formulario', () => {
    const opciones = (guardar: jasmine.Spy) => ({
      titulo: 'Nuevo',
      confirmar: 'Guardar',
      guardar,
      campos: [
        { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, maxlength: 10 },
        { nombre: 'correo', etiqueta: 'Correo', tipo: 'email' as const },
        { nombre: 'codigo', etiqueta: 'Código', patron: /^[A-Z]{2,4}$/, mensajePatron: 'de 2 a 4 letras mayúsculas.', mayusculas: true },
        { nombre: 'entidad', etiqueta: 'Entidad', tipo: 'select' as const, requerido: true, opciones: [{ valor: '', texto: 'Seleccione...' }, { valor: 7, texto: 'EPMMOP' }] },
        { nombre: 'emergencia', etiqueta: 'Es emergencia', tipo: 'casilla' as const },
      ],
    });

    function llenar(v: Record<string, string>) {
      for (const [k, valor] of Object.entries(v)) {
        const el = campo(k);
        el.value = valor;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    it('muestra los campos con sus etiquetas, el asterisco de obligatorio y los valores iniciales', async () => {
      const r = servicio.formulario({
        titulo: 'Editar', confirmar: 'Guardar', guardar: async () => 1,
        campos: [{ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: 'Ana <b>' }, { nombre: 'usuario', etiqueta: 'Usuario', deshabilitado: true, valor: 'ana' }],
      });
      await esperar();

      expect(Swal.getTitle()?.textContent).toBe('Editar');
      expect(campo('nombre').value).toBe('Ana <b>');           // se muestra como texto, no como HTML
      expect(document.querySelector('label[for="aq-campo-nombre"] .text-danger')).not.toBeNull();
      expect(campo('usuario').disabled).toBeTrue();
      expect(document.querySelector('label[for="aq-campo-usuario"] .text-danger')).toBeNull();
      Swal.clickCancel();
      expect(await r).toBeNull();
    });

    it('valida antes de guardar y muestra el mensaje DENTRO de la ventana sin cerrarla', async () => {
      const guardar = jasmine.createSpy('guardar').and.resolveTo('ok');
      const r = servicio.formulario(opciones(guardar));
      await esperar();

      Swal.clickConfirm();
      await esperar();
      expect(Swal.getValidationMessage()?.textContent).toContain('Nombre: es obligatorio');
      expect(guardar).not.toHaveBeenCalled();
      expect(Swal.isVisible()).toBeTrue();

      llenar({ nombre: 'Ana', correo: 'no-es-correo' });
      Swal.clickConfirm();
      await esperar();
      expect(Swal.getValidationMessage()?.textContent).toContain('ingrese un correo válido');

      llenar({ correo: 'ana@quito.ec', codigo: 'a1' });
      Swal.clickConfirm();
      await esperar();
      expect(Swal.getValidationMessage()?.textContent).toContain('de 2 a 4 letras mayúsculas');

      llenar({ codigo: 'AMT' });
      Swal.clickConfirm();
      await esperar();
      expect(Swal.getValidationMessage()?.textContent).toContain('Entidad: es obligatorio');
      expect(guardar).not.toHaveBeenCalled();

      llenar({ entidad: '7' });
      Swal.clickConfirm();
      expect(await r).toBe('ok');
    });

    it('entrega los valores con su tipo: texto recortado, número del select y booleano de la casilla', async () => {
      const guardar = jasmine.createSpy('guardar').and.resolveTo('listo');
      const r = servicio.formulario(opciones(guardar));
      await esperar();

      llenar({ nombre: '  Ana  ', entidad: '7' });
      campo('emergencia').checked = true;
      Swal.clickConfirm();
      await r;

      expect(guardar).toHaveBeenCalledWith(jasmine.objectContaining({ nombre: 'Ana', entidad: 7, emergencia: true, correo: '', codigo: '' }));
    });

    it('el texto con mayúsculas forzadas se escribe en mayúsculas', async () => {
      void servicio.formulario(opciones(jasmine.createSpy().and.resolveTo(1)));
      await esperar();

      campo('codigo').value = 'epm';
      campo('codigo').dispatchEvent(new Event('input', { bubbles: true }));

      expect(campo('codigo').value).toBe('EPM');
    });

    it('si guardar falla muestra el error dentro, no cierra y permite corregir y reintentar', async () => {
      const guardar = jasmine.createSpy('guardar').and.callFake(async () => {
        if (guardar.calls.count() === 1) throw new Error('El correo ya está registrado.');
        return 'guardado';
      });
      const r = servicio.formulario({ ...opciones(guardar), mensajeDeError: (e) => (e as Error).message });
      await esperar();

      llenar({ nombre: 'Ana', codigo: 'AMT', entidad: '7' });
      Swal.clickConfirm();
      await esperar();
      expect(Swal.getValidationMessage()?.textContent).toBe('El correo ya está registrado.');
      expect(Swal.isVisible()).toBeTrue();
      expect(campo('nombre').value).toBe('Ana');   // no pierde lo escrito

      Swal.clickConfirm();
      expect(await r).toBe('guardado');
      expect(guardar).toHaveBeenCalledTimes(2);
    });

    it('cancelar devuelve null sin guardar', async () => {
      const guardar = jasmine.createSpy('guardar');
      const r = servicio.formulario(opciones(guardar));
      await esperar();

      Swal.clickCancel();

      expect(await r).toBeNull();
      expect(guardar).not.toHaveBeenCalled();
    });

    it('el hook alCambiar permite que un campo modifique a otro', async () => {
      const r = servicio.formulario({
        titulo: 'Tipo', confirmar: 'Guardar', guardar: async () => 1,
        campos: [
          { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', valor: 4, opciones: [1, 2, 3, 4].map((valor) => ({ valor, texto: String(valor) })) },
          { nombre: 'emergencia', etiqueta: 'Emergencia', tipo: 'casilla' },
        ],
        alCambiar: (nombre, valores, asignar) => {
          if (nombre === 'emergencia' && valores['emergencia'] === true) asignar('prioridad', 1);
        },
      });
      await esperar();
      expect(campo('prioridad').value).toBe('4');

      campo('emergencia').checked = true;
      campo('emergencia').dispatchEvent(new Event('change', { bubbles: true }));

      expect(campo('prioridad').value).toBe('1');
      Swal.clickCancel();
      await r;
    });

    it('los textos de la ventana se escapan: un valor con HTML no inyecta nada', async () => {
      const r = servicio.formulario({
        titulo: 'T', subtitulo: '<img src=x onerror=alert(1)>', confirmar: 'OK', guardar: async () => 1,
        campos: [{ nombre: 'a', etiqueta: '<script>x</script>', ayuda: '<b>hola</b>' }],
      });
      await esperar();

      expect(document.querySelector('.swal2-popup img[src="x"]')).toBeNull();
      expect(document.querySelector('.swal2-popup [onerror]')).toBeNull();
      expect(document.querySelector('.swal2-popup script')).toBeNull();
      expect(document.querySelector('.swal2-popup b')).toBeNull();
      Swal.clickCancel();
      await r;
    });
  });

  describe('credencial', () => {
    it('muestra la clave temporal escapada y el aviso según se envió o no el correo', async () => {
      let r = servicio.credencial({ usuario: 'ana.perez', clave: 'Tm#<b>1', correoEnviado: false });
      await esperar();
      expect(Swal.getTitle()?.textContent).toContain('ana.perez');
      expect(document.getElementById('aq-clave-texto')?.textContent).toBe('Tm#<b>1');
      expect(document.querySelector('.swal2-popup b')).toBeNull();
      expect(Swal.getHtmlContainer()?.textContent).toContain('El correo no está habilitado');
      Swal.clickConfirm();
      await r;

      r = servicio.credencial({ usuario: 'ana.perez', clave: 'Abc#12345xy', correoEnviado: true });
      await esperar();
      expect(Swal.getHtmlContainer()?.textContent).toContain('También se envió por correo');
      Swal.clickConfirm();
      await r;
    });

    it('no se cierra al hacer clic fuera: la clave se muestra una sola vez', async () => {
      const r = servicio.credencial({ usuario: 'ana', clave: 'Abc#12345xy', correoEnviado: false });
      await esperar();

      (document.querySelector('.swal2-container') as HTMLElement).click();
      await esperar();

      expect(Swal.isVisible()).toBeTrue();
      Swal.clickConfirm();
      await r;
    });
  });

  it('error y detalle abren su ventana con el contenido', async () => {
    let r = servicio.error('No se puede.', 'Título');
    await esperar();
    expect(Swal.getTitle()?.textContent).toBe('Título');
    expect(Swal.getHtmlContainer()?.textContent).toBe('No se puede.');
    Swal.clickConfirm();
    await r;

    r = servicio.detalle({ titulo: 'Cambios', html: '<table><tr><td class="cambio">x</td></tr></table>' });
    await esperar();
    expect(document.querySelector('.swal2-popup td.cambio')?.textContent).toBe('x');
    Swal.clickConfirm();
    await r;
  });

  it('exito muestra un aviso breve que no bloquea la pantalla', async () => {
    servicio.exito('Guardado');
    await esperar();

    expect(Swal.getTitle()?.textContent).toBe('Guardado');
    expect(document.querySelector('.swal2-toast')).not.toBeNull();
    expect(Swal.getConfirmButton()?.style.display).toBe('none');
  });
});
