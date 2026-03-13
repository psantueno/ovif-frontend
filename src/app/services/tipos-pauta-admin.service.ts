import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_URL } from '../app.config';

export interface TipoPauta {
  tipo_pauta_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  requiere_periodo_rectificar: boolean;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

export interface TipoPautaPayload {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  requiere_periodo_rectificar: boolean;
}

export interface TiposPautaPageResponse {
  data: TipoPauta[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas?: number;
}

@Injectable({ providedIn: 'root' })
export class TiposPautaAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/tipos-pauta`;

  listarTiposPauta(params?: { pagina?: number; limite?: number; search?: string | null }): Observable<TiposPautaPageResponse> {
    const query: Record<string, string> = {};
    if (params?.pagina) query['pagina'] = String(params.pagina);
    if (params?.limite) query['limite'] = String(params.limite);
    if (params?.search) query['search'] = params.search.trim();

    return this.http.get<any>(`${this.baseUrl}/list`, { params: query }).pipe(
      map((response) => {
        const lista = this.unwrapResponseArray(response?.data ?? response);
        return {
          data: lista.map((item) => this.normalizeTipoPauta(item)),
          total: this.resolveTotal(response, lista.length),
          pagina: Number(response?.pagina ?? params?.pagina ?? 1),
          limite: Number(response?.limite ?? params?.limite ?? (lista.length || 10)),
          totalPaginas: this.resolveTotalPaginas(response),
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  getCatalogoTiposPauta(): Observable<TipoPauta[]> {
    return this.http.get<any>(`${this.baseUrl}/select`).pipe(
      map((response) => {
        const lista = this.unwrapResponseArray(response?.data ?? response);
        return lista.map((item) => this.normalizeTipoPauta(item));
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearTipoPauta(payload: TipoPautaPayload): Observable<TipoPauta> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => this.normalizeTipoPauta(response?.tipo_pauta ?? response)),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarTipoPauta(tipoPautaId: number, payload: TipoPautaPayload): Observable<TipoPauta> {
    return this.http.put<any>(`${this.baseUrl}/${tipoPautaId}`, payload).pipe(
      map((response) => this.normalizeTipoPauta(response?.tipo_pauta ?? response)),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarTipoPauta(tipoPautaId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${tipoPautaId}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private normalizeTipoPauta(data: any): TipoPauta {
    return {
      tipo_pauta_id: Number(data?.tipo_pauta_id ?? data?.id ?? 0),
      codigo: String(data?.codigo ?? '').trim(),
      nombre: String(data?.nombre ?? '').trim(),
      descripcion: data?.descripcion === undefined ? null : data.descripcion,
      requiere_periodo_rectificar: Boolean(data?.requiere_periodo_rectificar),
      fecha_creacion: data?.fecha_creacion,
      fecha_actualizacion: data?.fecha_actualizacion,
    };
  }

  private unwrapResponseArray(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.tipos_pauta)) return response.tipos_pauta;
    return [];
  }

  private resolveTotal(response: any, fallback: number): number {
    if (typeof response?.total === 'number') return response.total;
    if (typeof response?.total === 'string') {
      const parsed = Number(response.total);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return fallback;
  }

  private resolveTotalPaginas(response: any): number | undefined {
    if (typeof response?.totalPaginas === 'number') return response.totalPaginas;
    if (typeof response?.totalPaginas === 'string') {
      const parsed = Number(response.totalPaginas);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}
