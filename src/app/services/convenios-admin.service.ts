import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../app.config';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Convenio{
  convenio_id: number,
  nombre: string,
  descripcion: string,
  fecha_inicio: string,
  fecha_fin: string,
  modificable: boolean,
  fecha_creacion?: string,
  fecha_actualizacion?: string,
}

export interface ConvenioPageResponse {
  data: Convenio[],
  total: number,
  pagina: number,
  limite: number,
  totalPaginas?: number
}

export interface ConvenioPayload {
  nombre: string,
  descripcion: string,
  fecha_inicio: string,
  fecha_fin: string,
}

@Injectable({ providedIn: 'root' })
export class ConveniosAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/convenios`;

  listarConvenios(params?: { pagina?: number; limite?: number; search?: string | null }): Observable<ConvenioPageResponse> {
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
        const lista = this.unwrapResponseArray(response?.data ?? response?.convenios ?? response);
        return {
          data: lista.map((item) => this.normalizeConvenio(item)),
          total: this.resolveTotal(response, lista.length),
          pagina: Number(response?.pagina ?? params?.pagina ?? 1),
          limite: Number(response?.limite ?? params?.limite ?? (lista.length || 10)),
          totalPaginas: this.resolveTotalPaginas(response)
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearConvenio(payload: ConvenioPayload): Observable<Convenio> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => {
        const convenio = response?.convenio ?? this.unwrapResponseItem(response);
        return this.normalizeConvenio(convenio);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarConvenio(id: number, payload: ConvenioPayload): Observable<Convenio> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map((response) => {
        const convenio = response?.convenio ?? this.unwrapResponseItem(response);
        return this.normalizeConvenio(convenio);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarConvenio(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private normalizeConvenio(data: any): Convenio {
    if (!data) {
      return {
        convenio_id: 0,
        nombre: 'Convenio sin nombre',
        descripcion: 'Convenio sin descripción',
        fecha_inicio: '01/01/1900',
        fecha_fin: '02/01/1900',
        modificable: false,
      };
    }

    const toDate = (date: string) => {
      let validDate = '01/01/1900';

      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(date)) return validDate;

      const [year, month, day] = date.split('-').map(Number);
      validDate = `${day}/${month}/${year}`

      return validDate;
    }

    return {
      convenio_id: Number(data?.convenio_id ?? data?.id ?? 0),
      nombre: String(data?.nombre ?? data?.convenio_nombre ?? 'Convenios sin nombre'),
      descripcion: String(data?.descripcion ?? data?.convenio_descripcion ?? 'Convenios sin descripcion'),
      fecha_inicio: toDate(data?.fecha_inicio ?? data?.convenio_fecha_inicio ?? ''),
      fecha_fin: toDate(data?.fecha_fin ?? data?.convenio_fecha_fin ?? ''),
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
    if (Array.isArray(response?.convenios)) {
      return response.convenios;
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
