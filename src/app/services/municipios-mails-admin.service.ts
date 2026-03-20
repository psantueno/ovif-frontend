import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../app.config';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface MunicipioMail{
  municipio_id: number,
  email: string,
  nombre: string,
  municipio_nombre: string
}

export interface MunicipioMailPageResponse {
  data: MunicipioMail[],
  total: number,
  pagina: number,
  limite: number,
  totalPaginas?: number
}

export interface MunicipioMailPayload {
  municipio_id: number,
  email: string,
  nombre: string,
}

@Injectable({ providedIn: 'root' })
export class MunicipiosMailsAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/municipios-mails`;

  listarMailsMunicipios(params?: { pagina?: number; limite?: number; search?: string | null }): Observable<MunicipioMailPageResponse> {
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
        const lista = this.unwrapResponseArray(response?.data ?? response?.mails ?? response);
        return {
          data: lista.map((item) => this.normalizeMunicipioMail(item)),
          total: this.resolveTotal(response, lista.length),
          pagina: Number(response?.pagina ?? params?.pagina ?? 1),
          limite: Number(response?.limite ?? params?.limite ?? (lista.length || 10)),
          totalPaginas: this.resolveTotalPaginas(response)
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  listarMunicipiosSinMail(): Observable<string[]> {
    return this.http.get<any>(`${this.baseUrl}/sin-mail`).pipe(
      map((response) => {
        return response
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearMunicipioMail(payload: MunicipioMailPayload): Observable<MunicipioMail> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => {
        const mail = response?.mail ?? this.unwrapResponseItem(response);
        return this.normalizeMunicipioMail(mail);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarMunicipioMail(municipio_id: number, email: string, payload: MunicipioMailPayload): Observable<MunicipioMail> {
    return this.http.put<any>(`${this.baseUrl}/${municipio_id}/${email}`, payload).pipe(
      map((response) => {
        const mail = response?.mail ?? this.unwrapResponseItem(response);
        return this.normalizeMunicipioMail(mail);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarMunicipioMail(municipio_id: number, email: string,): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${municipio_id}/${email}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private normalizeMunicipioMail(data: any): MunicipioMail {
    if (!data) {
      return {
        municipio_id: 0,
        email: '',
        nombre: '',
        municipio_nombre: ''
      };
    }

    return {
      municipio_id: Number(data?.municipio_id ?? 0),
      email: String(data?.email ?? 'Email no especificado'),
      nombre: String(data?.nombre ?? 'Nombre no especificado'),
      municipio_nombre: String(data?.municipio_nombre ?? 'Municipio no especificado')
    }
  }

  private unwrapResponseArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response?.data)) {
      return response.data;
    }
    if (Array.isArray(response?.mails)) {
      return response.mails;
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
