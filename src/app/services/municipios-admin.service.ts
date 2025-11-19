import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../app.config';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Municipio {
  municipio_id: number;
  municipio_nombre: string;
  municipio_usuario: string;
  municipio_password?: string | null;
  municipio_spar: boolean;
  municipio_ubge: boolean;
  municipio_subir_archivos: boolean;
  municipio_poblacion: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MunicipiosPageResponse {
  data: Municipio[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas?: number;
}

export interface MunicipioPayload {
  municipio_nombre: string;
  municipio_usuario: string;
  municipio_password?: string | null;
  municipio_spar: boolean;
  municipio_ubge: boolean;
  municipio_subir_archivos: boolean;
  municipio_poblacion: number;
}

@Injectable({ providedIn: 'root' })
export class MunicipiosAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/municipios`;

  listarMunicipios(params?: { pagina?: number; limite?: number; search?: string | null }): Observable<MunicipiosPageResponse> {
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

    return this.http.get<any>(this.baseUrl, { params: query }).pipe(
      map((response) => {
        const lista = this.unwrapResponseArray(response?.data ?? response?.municipios ?? response);
        return {
          data: lista.map((item) => this.normalizeMunicipio(item)),
          total: this.resolveTotal(response, lista.length),
          pagina: Number(response?.pagina ?? params?.pagina ?? 1),
          limite: Number(response?.limite ?? params?.limite ?? (lista.length || 10)),
          totalPaginas: this.resolveTotalPaginas(response)
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearMunicipio(payload: MunicipioPayload): Observable<Municipio> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => {
        const municipio = response?.municipio ?? this.unwrapResponseItem(response);
        return this.normalizeMunicipio(municipio);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarMunicipio(id: number, payload: MunicipioPayload): Observable<Municipio> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map((response) => {
        const municipio = response?.municipio ?? this.unwrapResponseItem(response);
        return this.normalizeMunicipio(municipio);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarMunicipio(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private normalizeMunicipio(data: any): Municipio {
    if (!data) {
      return {
        municipio_id: 0,
        municipio_nombre: 'Municipio sin nombre',
        municipio_usuario: '',
        municipio_spar: false,
        municipio_ubge: false,
        municipio_subir_archivos: false,
        municipio_poblacion: 0
      };
    }

    const toBoolean = (value: unknown): boolean => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'number') {
        return value === 1;
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'si' || normalized === 'sí';
      }
      return false;
    };

    return {
      municipio_id: Number(data?.municipio_id ?? data?.id ?? 0),
      municipio_nombre: String(data?.municipio_nombre ?? data?.nombre ?? 'Municipio sin nombre').trim(),
      municipio_usuario: String(data?.municipio_usuario ?? data?.usuario ?? '').trim(),
      municipio_password: data?.municipio_password ?? null,
      municipio_spar: toBoolean(data?.municipio_spar),
      municipio_ubge: toBoolean(data?.municipio_ubge),
      municipio_subir_archivos: toBoolean(data?.municipio_subir_archivos),
      municipio_poblacion: Number(data?.municipio_poblacion ?? data?.poblacion ?? 0),
      createdAt: data?.createdAt ?? data?.created_at ?? null,
      updatedAt: data?.updatedAt ?? data?.updated_at ?? null
    };
  }

  private unwrapResponseArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response?.data)) {
      return response.data;
    }
    if (Array.isArray(response?.municipios)) {
      return response.municipios;
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
