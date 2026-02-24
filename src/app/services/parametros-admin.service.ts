import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_URL } from '../app.config';

export interface Parametro {
  parametro_id: number;
  nombre: string;
  valor: string;
  descripcion: string | null;
  estado: boolean;
  creado_por?: number | null;
  creado_por_usuario?: string | null;
  creado_por_nombre?: string | null;
  actualizado_por?: number | null;
  actualizado_por_usuario?: string | null;
  actualizado_por_nombre?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ParametroPayload {
  nombre: string;
  valor: string;
  descripcion?: string | null;
  estado?: boolean;
}

export interface ParametrosPageResponse {
  data: Parametro[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas?: number;
}

@Injectable({ providedIn: 'root' })
export class ParametrosAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/parametros`;

  listarParametros(params?: { pagina?: number; limite?: number; search?: string | null }): Observable<ParametrosPageResponse> {
    const query: Record<string, string> = {};
    if (params?.pagina) query['pagina'] = String(params.pagina);
    if (params?.limite) query['limite'] = String(params.limite);
    if (params?.search) query['search'] = params.search.trim();

    return this.http.get<any>(`${this.baseUrl}/list`, { params: query }).pipe(
      map((response) => {
        const lista = this.unwrapResponseArray(response?.data ?? response);
        return {
          data: lista.map((item) => this.normalizeParametro(item)),
          total: this.resolveTotal(response, lista.length),
          pagina: Number(response?.pagina ?? params?.pagina ?? 1),
          limite: Number(response?.limite ?? params?.limite ?? (lista.length || 10)),
          totalPaginas: this.resolveTotalPaginas(response),
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearParametro(payload: ParametroPayload): Observable<Parametro> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => this.normalizeParametro(response?.parametro ?? response)),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarParametro(id: number, payload: ParametroPayload): Observable<Parametro> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map((response) => this.normalizeParametro(response?.parametro ?? response)),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarEstadoParametro(id: number, estado: boolean): Observable<Parametro> {
    return this.http.put<any>(`${this.baseUrl}/${id}/estado`, { estado }).pipe(
      map((response) => this.normalizeParametro(response?.parametro ?? response)),
      catchError((error) => throwError(() => error))
    );
  }

  getParametroById(id: number): Observable<Parametro> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map((response) => this.normalizeParametro(response)),
      catchError((error) => throwError(() => error))
    );
  }

  private normalizeParametro(data: any): Parametro {
    return {
      parametro_id: Number(data?.parametro_id ?? data?.id ?? 0),
      nombre: String(data?.nombre ?? ''),
      valor: String(data?.valor ?? ''),
      descripcion: data?.descripcion ?? null,
      estado: Boolean(data?.estado),
      creado_por: data?.creado_por ?? null,
      creado_por_usuario: data?.creado_por_usuario ?? null,
      creado_por_nombre: data?.creado_por_nombre ?? null,
      actualizado_por: data?.actualizado_por ?? null,
      actualizado_por_usuario: data?.actualizado_por_usuario ?? null,
      actualizado_por_nombre: data?.actualizado_por_nombre ?? null,
      created_at: data?.created_at,
      updated_at: data?.updated_at,
    };
  }

  private unwrapResponseArray(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
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
