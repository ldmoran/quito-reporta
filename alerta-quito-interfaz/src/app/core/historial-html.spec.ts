import { armarVistaHistorial, htmlHistorial, nombreColumna } from './historial-html';

const version = (extra: Record<string, string | number | boolean | null>) => ({
  id_hist: 1, operacion: 'UPDATE', usuario_accion: 'admin', fecha_accion: '2026-10-12T10:00:00', id_entidad: 3, nombre: 'Antes', estado: 'A', ...extra,
});

describe('historial de auditoría', () => {
  it('detecta qué campos cambiaron entre versiones sucesivas', () => {
    const vista = armarVistaHistorial([version({ operacion: 'INSERT' }), version({ nombre: 'Despues' }), version({ nombre: 'Despues', estado: 'I' })]);

    expect(vista.columnas).toEqual(['id_entidad', 'nombre', 'estado']);
    expect([...vista.filas[0].cambiados]).toEqual([]);
    expect([...vista.filas[1].cambiados]).toEqual(['nombre']);
    expect([...vista.filas[2].cambiados]).toEqual(['estado']);
  });

  it('una lista vacía no rompe', () => {
    expect(armarVistaHistorial([]).filas).toEqual([]);
    expect(htmlHistorial(armarVistaHistorial([]))).toContain('No hay versiones');
  });

  it('el HTML resalta lo que cambió y traduce acción y booleanos', () => {
    const html = htmlHistorial(armarVistaHistorial([
      version({ operacion: 'INSERT', es_emergencia: false }),
      version({ nombre: 'Despues', es_emergencia: true }),
    ]));

    expect(html).toContain('<td class="cambio">Despues</td>');
    expect(html).toContain('<td class="cambio">Sí</td>');
    expect(html).toContain('<td>Creación</td>');
    expect(html).toContain('<td>Edición</td>');
    expect(html).toContain('12/10/2026 10:00:00');
  });

  it('escapa el contenido para que nada de la base se ejecute como HTML', () => {
    const html = htmlHistorial(armarVistaHistorial([version({ nombre: '<img src=x onerror=alert(1)>', usuario_accion: '"><script>x</script>' })]));

    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('muestra "-" para valores vacíos y nombres de columna legibles', () => {
    expect(htmlHistorial(armarVistaHistorial([version({ nombre: null })]))).toContain('<td>-</td>');
    expect(nombreColumna('id_entidad')).toBe('ID entidad');
    expect(nombreColumna('es_emergencia')).toBe('Es emergencia');
  });
});
