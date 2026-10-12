/**
 * Marca de la aplicación. Para cambiar el logo o las imágenes de fondo del login basta
 * con copiar los archivos nuevos a `public/images/` y ajustar estos nombres
 * (igual que se hacía en el SGFDM con logo.png y slide1..4.jpg).
 */
export const MARCA = {
  nombre: 'Alerta Quito',
  tituloSistema: 'Sistema de Reporte de Incidentes Viales y de Seguridad',
  version: 'Sistema v1.0',
  /** Logo vertical para el panel de acceso (fondo claro). */
  logo: 'images/logo.svg',
  /** Logo horizontal blanco para la cabecera azul. */
  logoHorizontal: 'images/logo_horizontal.svg',
  /** Imágenes que rotan de fondo en el login y el registro. */
  slides: ['images/slide1.svg', 'images/slide2.svg', 'images/slide3.svg', 'images/slide4.svg'],
  /** Cada cuántos milisegundos cambia la imagen de fondo. */
  intervaloSlidesMs: 6000,
  ayudaContrasena: 'Comuníquese con el administrador del sistema.',
} as const;
