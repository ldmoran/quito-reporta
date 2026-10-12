import { Injectable, InjectionToken, inject } from '@angular/core';

/** Lo mínimo que usamos de la Web Speech API (no viene en los tipos de TypeScript). */
export interface ReconocedorVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoResultadoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface EventoResultadoVoz {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export type FabricaReconocedor = (() => ReconocedorVoz) | null;

/** Chrome, Edge y Safari la exponen; Firefox no. En las pruebas se reemplaza por una falsa. */
export const FABRICA_RECONOCEDOR = new InjectionToken<FabricaReconocedor>('FABRICA_RECONOCEDOR', {
  providedIn: 'root',
  factory: () => {
    const w = window as unknown as Record<string, new () => ReconocedorVoz>;
    const Constructor = w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
    return Constructor ? () => new Constructor() : null;
  },
});

export interface SesionDictado {
  detener(): void;
}

export interface OyentesDictado {
  /** Texto confirmado acumulado y texto provisional que aún se está reconociendo. */
  alTexto: (confirmado: string, provisional: string) => void;
  /** Se llama una sola vez al terminar; `error` trae un mensaje para la persona si algo falló. */
  alTerminar: (error?: string) => void;
}

const MENSAJES: Record<string, string> = {
  'not-allowed': 'Permiso de micrófono denegado. Permítalo en el navegador para usar el dictado.',
  'service-not-allowed': 'El navegador no permite el dictado en este momento.',
  'audio-capture': 'No se detectó un micrófono.',
  network: 'No hay conexión para reconocer la voz. Intente de nuevo.',
  'language-not-supported': 'El navegador no soporta el dictado en español.',
};

/**
 * Dictado por voz con la Web Speech API del navegador. Aviso: en Chrome el audio se envía a los
 * servidores de Google para transcribirlo, y el navegador exige HTTPS (o localhost) para el micrófono.
 */
@Injectable({ providedIn: 'root' })
export class DictadoService {
  private readonly fabrica = inject(FABRICA_RECONOCEDOR);

  get disponible(): boolean {
    return this.fabrica !== null;
  }

  iniciar(oyentes: OyentesDictado): SesionDictado | null {
    if (!this.fabrica) return null;
    const reconocedor = this.fabrica();
    reconocedor.lang = 'es-EC';
    reconocedor.continuous = true;
    reconocedor.interimResults = true;

    let confirmado = '';
    let terminado = false;
    const terminar = (error?: string) => {
      if (terminado) return;
      terminado = true;
      oyentes.alTerminar(error);
    };

    reconocedor.onresult = (e) => {
      let provisional = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const resultado = e.results[i];
        const frase = resultado[0].transcript.trim();
        if (resultado.isFinal) confirmado = `${confirmado} ${frase}`.trim();
        else provisional = `${provisional} ${frase}`.trim();
      }
      oyentes.alTexto(confirmado, provisional);
    };
    // 'no-speech' y 'aborted' no son fallos: simplemente nadie habló o la persona detuvo el dictado.
    reconocedor.onerror = (e) =>
      terminar(e.error === 'no-speech' || e.error === 'aborted' ? undefined : (MENSAJES[e.error] ?? 'No se pudo usar el dictado por voz.'));
    reconocedor.onend = () => terminar();

    try {
      reconocedor.start();
    } catch {
      terminar('No se pudo iniciar el dictado por voz.');
      return null;
    }
    return { detener: () => reconocedor.stop() };
  }
}
