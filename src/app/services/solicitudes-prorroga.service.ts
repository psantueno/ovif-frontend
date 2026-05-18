import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../app.config';

// ─── Interfaces de dominio ────────────────────────────────────────────────────

export interface SolicitudProrroga {
  solicitud_id: number;
  grupo_solicitud_id: string;
  municipio_id: number;
  ejercicio: number;
  mes: number;
  convenio_id: number;
  pauta_id: number;
  prorroga_id: number | null;
  estado: EstadoSolicitud;
  fecha_cierre_solicitada: string;       // YYYY-MM-DD (respuesta del backend)
  fecha_cierre_anterior: string | null;
  fecha_cierre_aprobada: string | null;
  motivo: string;
  solicitado_por: number;
  fecha_solicitud: string;               // ISO
  actualizado_por: number | null;
  resuelto_por: number | null;
  fecha_resolucion: string | null;
  comentario_resolucion: string | null;
  cancelado_por: number | null;
  fecha_cancelacion: string | null;
  motivo_cancelacion: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  // Asociaciones
  Municipio?: { municipio_id: number; municipio_nombre: string };
  Convenio?: { convenio_id: number; nombre: string };
  PautaConvenio?: { pauta_id: number; descripcion: string };
  Solicitante?: { usuario_id: number; nombre: string; apellido: string };
  Resolutor?: { usuario_id: number; nombre: string; apellido: string } | null;
  SolicitudProrrogaEstados?: SolicitudProrrogaEstado[];
}

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';

export interface SolicitudProrrogaEstado {
  auditoria_id: number;
  solicitud_id: number;
  accion: 'CREADA' | 'EDITADA' | 'CANCELADA' | 'APROBADA' | 'RECHAZADA';
  estado_anterior: EstadoSolicitud | null;
  estado_nuevo: EstadoSolicitud;
  payload_anterior: Record<string, unknown> | null;
  payload_nuevo: Record<string, unknown> | null;
  usuario_id: number;
  fecha_evento: string;
  comentario: string | null;
  Usuario?: { usuario_id: number; nombre: string; apellido: string };
}

// Ítem individual que se envía en el POST (sin grupo_solicitud_id — lo genera el backend)
export interface SolicitudProrrogaItem {
  municipio_id: number;
  ejercicio: number;
  mes: number;
  convenio_id: number;
  pauta_id: number;
  fecha_cierre_solicitada: string;       // DD-MM-YYYY (formato requerido por el backend)
  motivo: string;
}

export interface SolicitudProrrogaFiltros {
  estado?: EstadoSolicitud | '';
  municipio_id?: number | '';
  ejercicio?: number | '';
  mes?: number | '';
  convenio_id?: number | '';
  pauta_id?: number | '';
  solicitado_por?: number | '';
  grupo_solicitud_id?: string;
  fecha_solicitud_desde?: string;        // DD-MM-YYYY
  fecha_solicitud_hasta?: string;
  fecha_resolucion_desde?: string;
  fecha_resolucion_hasta?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedSolicitudes {
  total: number;
  page: number;
  limit: number;
  data: SolicitudProrroga[];
}

export interface AprobarLoteItem {
  solicitud_id: number;
  fecha_cierre_aprobada?: string;        // DD-MM-YYYY, opcional
  comentario_resolucion?: string;
}

export interface RechazarLoteItem {
  solicitud_id: number;
  comentario_resolucion: string;
}

export interface ResultadoLote {
  solicitud_id: number;
  success: boolean;
  error?: string;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SolicitudesProrrogaService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);

  private get base(): string {
    return `${this.apiUrl}/solicitudes-prorroga`;
  }

  /** Crea una o más solicitudes en lote. Todas comparten el mismo grupo_solicitud_id generado por el backend. */
  crear(items: SolicitudProrrogaItem[]): Observable<{ message: string; grupo_solicitud_id: string; solicitudes: SolicitudProrroga[] }> {
    return this.http.post<any>(this.base, items);
  }

  /** Lista solicitudes con filtros y paginación. El backend restringe por municipios del operario. */
  listar(filtros: SolicitudProrrogaFiltros = {}): Observable<PaginatedSolicitudes> {
    let params = new HttpParams();

    const entries: [string, string | number | undefined][] = [
      ['estado', filtros.estado],
      ['municipio_id', filtros.municipio_id],
      ['ejercicio', filtros.ejercicio],
      ['mes', filtros.mes],
      ['convenio_id', filtros.convenio_id],
      ['pauta_id', filtros.pauta_id],
      ['solicitado_por', filtros.solicitado_por],
      ['grupo_solicitud_id', filtros.grupo_solicitud_id],
      ['fecha_solicitud_desde', filtros.fecha_solicitud_desde],
      ['fecha_solicitud_hasta', filtros.fecha_solicitud_hasta],
      ['fecha_resolucion_desde', filtros.fecha_resolucion_desde],
      ['fecha_resolucion_hasta', filtros.fecha_resolucion_hasta],
      ['page', filtros.page],
      ['limit', filtros.limit],
    ];

    for (const [key, value] of entries) {
      if (value !== undefined && value !== '' && value !== null) {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<PaginatedSolicitudes>(this.base, { params });
  }

  /** Obtiene detalle completo de una solicitud, incluyendo SolicitudProrrogaEstados. */
  obtener(id: number): Observable<SolicitudProrroga> {
    return this.http.get<SolicitudProrroga>(`${this.base}/${id}`);
  }

  /** Edita fecha_cierre_solicitada y/o motivo de una solicitud PENDIENTE. */
  editar(id: number, payload: { fecha_cierre_solicitada?: string; motivo?: string }): Observable<{ message: string; solicitud: SolicitudProrroga }> {
    return this.http.put<any>(`${this.base}/${id}`, payload);
  }

  /** Cancela una solicitud PENDIENTE. motivo_cancelacion es obligatorio. */
  cancelar(id: number, motivo_cancelacion: string): Observable<{ message: string; solicitud: SolicitudProrroga }> {
    return this.http.put<any>(`${this.base}/${id}/cancelar`, { motivo_cancelacion });
  }

  /**
   * Aprueba una solicitud PENDIENTE. Si se omite fecha_cierre_aprobada, el backend usa la solicitada.
   * Si fecha_cierre_solicitada ya venció, el campo se vuelve obligatorio.
   */
  aprobar(
    id: number,
    payload: { fecha_cierre_aprobada?: string; comentario_resolucion?: string }
  ): Observable<{ message: string; solicitud: SolicitudProrroga }> {
    return this.http.put<any>(`${this.base}/${id}/aprobar`, payload);
  }

  /** Rechaza una solicitud PENDIENTE. comentario_resolucion es obligatorio. */
  rechazar(id: number, comentario_resolucion: string): Observable<{ message: string; solicitud: SolicitudProrroga }> {
    return this.http.put<any>(`${this.base}/${id}/rechazar`, { comentario_resolucion });
  }

  /** Aprueba múltiples solicitudes pendientes. Cada ítem se procesa de forma independiente. */
  aprobarLote(items: AprobarLoteItem[]): Observable<{ resultados: ResultadoLote[] }> {
    return this.http.put<any>(`${this.base}/aprobar-lote`, { items });
  }

  /** Rechaza múltiples solicitudes pendientes. comentario_resolucion es obligatorio por ítem. */
  rechazarLote(items: RechazarLoteItem[]): Observable<{ resultados: ResultadoLote[] }> {
    return this.http.put<any>(`${this.base}/rechazar-lote`, { items });
  }
}

// ─── Utilidades de fecha ──────────────────────────────────────────────────────

/** Convierte un objeto Date o string YYYY-MM-DD a formato DD-MM-YYYY requerido por el backend. */
export function formatearFechaParaBackend(fecha: Date | string | null | undefined): string | undefined {
  if (!fecha) return undefined;

  if (fecha instanceof Date) {
    const d = String(fecha.getDate()).padStart(2, '0');
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const y = fecha.getFullYear();
    return `${d}-${m}-${y}`;
  }

  // Si ya viene como YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split('-');
    return `${d}-${m}-${y}`;
  }

  return fecha; // ya está en DD-MM-YYYY u otro formato
}

/** Convierte un string YYYY-MM-DD a formato legible DD/MM/YYYY para mostrar en pantalla. */
export function mostrarFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  }
  return fecha;
}

/** Etiquetas de meses en español. */
export const MESES_LABELS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
};
