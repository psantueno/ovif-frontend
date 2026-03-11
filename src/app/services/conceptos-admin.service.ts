import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../app.config';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Concepto{
  cod_concepto: number,
  descripcion: string,
  cod_recurso: number | null,
  modificable: boolean,
  fecha_creacion?: string,
  fecha_actualizacion?: string,
}

export interface ConceptoPageResponse {
  data: Concepto[],
  total: number,
  pagina: number,
  limite: number,
  totalPaginas?: number
}

export interface ConceptoPayload {
  cod_concepto: number,
  descripcion: string,
  cod_recurso: number | null
}

@Injectable({ providedIn: 'root' })
export class ConceptosAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/conceptos-recaudaciones`;

  listarConceptos(params?: { pagina?: number; limite?: number; search?: string | null }): Observable<ConceptoPageResponse> {
    const query: Record<string, string> = {};
    if (params?.pagina) {
      query['pagina'] = String(params.pagina);
    }
    if (params?.limite) {
      query['limite'] = String(params.limite);
    }
    if (params?.search) {
      query['search'] = params.search.trim();
    }

    return this.http.get<any>(`${this.baseUrl}/list`, { params: query }).pipe(
      map((response) => {
        const lista = this.unwrapResponseArray(response?.data ?? response?.conceptos ?? response);
        return {
          data: lista.map((item) => this.normalizeConcepto(item)),
          total: this.resolveTotal(response, lista.length),
          pagina: Number(response?.pagina ?? params?.pagina ?? 1),
          limite: Number(response?.limite ?? params?.limite ?? (lista.length || 10)),
          totalPaginas: this.resolveTotalPaginas(response)
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearConcepto(payload: ConceptoPayload): Observable<Concepto> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => {
        const concepto = response?.concepto ?? this.unwrapResponseItem(response);
        return this.normalizeConcepto(concepto);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarConcepto(id: number, payload: ConceptoPayload): Observable<Concepto> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map((response) => {
        const concepto = response?.concepto ?? this.unwrapResponseItem(response);
        return this.normalizeConcepto(concepto);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarConcepto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private normalizeConcepto(data: any): Concepto {
    if (!data) {
      return {
        cod_concepto: 0,
        descripcion: 'Concepto sin descripción',
        cod_recurso: null,
        modificable: false,
      };
    }

    return {
      cod_concepto: Number(data?.cod_concepto ?? 0),
      descripcion: String(data?.descripcion ?? 'Concepto sin descripcion'),
      cod_recurso: data?.cod_recurso ? Number(data.cod_recurso) : null,
      modificable: data?.modificable ?? false
    }
  }

  private unwrapResponseArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response?.data)) {
      return response.data;
    }
    if (Array.isArray(response?.conceptos)) {
      return response.conceptos;
    }
    return [];
  }

  private unwrapResponseItem(response: any): any {
    if (!response) {
      return null;
    }
    if (Array.isArray(response)) {
      return response[0] ?? null;
    }
    if (response?.data && !Array.isArray(response.data)) {
      return response.data;
    }
    return response;
  }

  private resolveTotal(response: any, fallback: number): number {
    if (typeof response?.total === 'number') {
      return response.total;
    }
    if (typeof response?.total === 'string') {
      const parsed = Number(response.total);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    if (Array.isArray(response)) {
      return response.length;
    }
    return fallback;
  }

  private resolveTotalPaginas(response: any): number | undefined {
    if (typeof response?.totalPaginas === 'number') {
      return response.totalPaginas;
    }
    if (typeof response?.totalPaginas === 'string') {
      const parsed = Number(response.totalPaginas);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}
