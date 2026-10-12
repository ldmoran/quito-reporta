export type Perfil = 'CIUDAD' | 'FUNCIO' | 'ADMINI';

export type EstadoReporte = 'REGISTRADO' | 'EN_REVISION' | 'EN_ATENCION' | 'RESUELTO' | 'RECHAZADO';

export interface Sesion {
  idUsuario: number;
  usuario: string;
  nombre: string;
  perfiles: Perfil[];
  token: string;
  /** Momento (ms desde epoch) en que vence el token. */
  venceEn: number;
  /** La clave la puso el administrador: debe cambiarla antes de usar el sistema. */
  debeCambiarPassword: boolean;
}

export interface RespuestaAuth {
  idUsuario: number;
  usuario: string;
  nombre: string;
  perfiles: Perfil[];
  token: string;
  expiraEnSegundos: number;
  debeCambiarPassword: boolean;
}

export interface RegistroCiudadano {
  nombreCompleto: string;
  cedula: string;
  correo: string;
  usuario: string;
  password: string;
}

export interface TipoIncidente {
  id: number;
  nombre: string;
  entidadCodigo: string;
  entidadNombre: string;
  prioridad: number;
  esEmergencia: boolean;
}

export interface Entidad {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
}

export interface NuevoReporte {
  idTipoIncidente: number;
  descripcion: string;
  latitud: number;
  longitud: number;
  direccion: string;
  referencia: string;
}

export interface ReporteResumen {
  id: number;
  codigo: string;
  tipoIncidente: string;
  entidad: string;
  prioridad: number;
  estado: EstadoReporte;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  direccion: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface HistorialEstado {
  estadoAnterior: string | null;
  estadoNuevo: string;
  usuario: string;
  comentario: string | null;
  fecha: string;
}

export interface EvidenciaReporte {
  id: number;
  tipo: 'CREACION' | 'RESOLUCION';
  nombreArchivo: string;
  subidoPor: string;
  fecha: string;
}

export interface ReporteDetalle {
  reporte: ReporteResumen;
  referencia: string | null;
  ciudadano: string;
  entidadNombre: string;
  historial: HistorialEstado[];
  evidencias: EvidenciaReporte[];
}

export interface Funcionario {
  id: number;
  usuario: string;
  nombreCompleto: string;
  correo: string;
  entidadCodigo: string;
  entidadNombre: string;
  cargo: string | null;
  estado: 'A' | 'I';
  fechaDesignacion: string;
}

export interface NuevoFuncionario {
  nombreCompleto: string;
  cedula: string;
  correo: string;
  usuario: string;
  /** Opcional: si no se envía, el sistema genera una clave temporal. */
  password?: string;
  idEntidad: number;
  cargo: string;
}

export interface FuncionarioCreado {
  funcionario: Funcionario;
  passwordTemporal: string;
  correoEnviado: boolean;
}

export interface CredencialesTemporales {
  usuario: string;
  passwordTemporal: string;
  correoEnviado: boolean;
}

export interface Estadisticas {
  total: number;
  porEstado: Record<string, number>;
  porTipo: Record<string, number>;
}
