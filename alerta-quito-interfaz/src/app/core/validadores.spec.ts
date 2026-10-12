import { FormControl } from '@angular/forms';
import { claveSegura, evaluarClave } from './validadores';

const faltan = (clave: string, usuario = '') =>
  evaluarClave(clave, usuario).filter((r) => !r.cumple).map((r) => r.clave);

describe('política de contraseñas', () => {
  it('acepta claves que cumplen todas las reglas', () => {
    for (const clave of ['Clave123*', 'Admin123*', 'Quito-2026#Seguro', 'Ñandú9$ñandú']) {
      expect(faltan(clave)).withContext(clave).toEqual([]);
    }
  });

  it('indica exactamente qué regla falta', () => {
    expect(faltan('abc')).toEqual(['largo', 'mayuscula', 'numero', 'simbolo']);
    expect(faltan('abcdefg1*')).toEqual(['mayuscula']);
    expect(faltan('ABCDEFG1*')).toEqual(['minuscula']);
    expect(faltan('Abcdefgh*')).toEqual(['numero']);
    expect(faltan('Abcdefg12')).toEqual(['simbolo']);
    expect(faltan('Abc 1234*')).toEqual(['espacios']);
  });

  it('rechaza claves de más de 72 caracteres', () => {
    expect(faltan('Aa1*' + 'x'.repeat(69))).toEqual(['largo']);
    expect(faltan('Aa1*' + 'x'.repeat(68))).toEqual([]);
  });

  it('no permite que la clave contenga el usuario', () => {
    expect(faltan('Maria2026*', 'maria')).toEqual(['usuario']);
    expect(faltan('Quito2026*', 'maria')).toEqual([]);
    expect(faltan('Quito2026*', 'ab')).toEqual([]); // usuarios muy cortos no aplican
  });

  it('el validador deja pasar vacío (de eso se encarga required) y marca las débiles', () => {
    const validador = claveSegura(() => 'maria');

    expect(validador(new FormControl(''))).toBeNull();
    expect(validador(new FormControl('Quito2026*'))).toBeNull();
    expect(validador(new FormControl('debil'))?.['claveSegura']).toContain('mayuscula');
    expect(validador(new FormControl('Maria2026*'))?.['claveSegura']).toEqual(['usuario']);
  });
});
