import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../app.config';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Pauta{
  pauta_id: number,
  convenio_id: number,
  convenio_nombre: string,
  descripcion: string,
  cant_dias_rectifica: number,
  plazo_mes_rectifica: number,
  dia_vto: number,
  plazo_vto: number,
  tipo_pauta: string,
  modificable: boolean,
  fecha_creacion?: string,
  fecha_actualizacion?: string,
}

export interface PautaPageResponse {
  data: Pauta[],
  total: number,
  pagina: number,
  limite: number,
  totalPaginas?: number
}

export interface PautaPayload {
  convenio_id: number,
  descripcion: string,
  cant_dias_rectifica: number,
  plazo_mes_rectifica: number,
  dia_vto: number,
  plazo_vto: number,
  tipo_pauta: string
}

@Injectable({ providedIn: 'root' })
export class PautasAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/pautas-convenio`;

  listarPautas(params?: { pagina?: number; limite?: number; search?: string | null }): Observable<PautaPageResponse> {
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
        const lista = this.unwrapResponseArray(response?.data ?? response?.pautas ?? response);
        return {
          data: lista.map((item) => this.normalizePauta(item)),
          total: this.resolveTotal(response, lista.length),
          pagina: Number(response?.pagina ?? params?.pagina ?? 1),
          limite: Number(response?.limite ?? params?.limite ?? (lista.length || 10)),
          totalPaginas: this.resolveTotalPaginas(response)
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearPauta(payload: PautaPayload): Observable<Pauta> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => {
        const pauta = response?.pauta ?? this.unwrapResponseItem(response);
        return this.normalizePauta(pauta);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarPauta(id: number, payload: PautaPayload): Observable<Pauta> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload).pipe(
      map((response) => {
        const pauta = response?.pauta ?? this.unwrapResponseItem(response);
        return this.normalizePauta(pauta);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarPauta(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private normalizePauta(data: any): Pauta {
    if (!data) {
      return {
        pauta_id: 0,
        convenio_id: 0,
        convenio_nombre: 'Convenio sin nombre',
        descripcion: 'Pauta sin descripción',
        dia_vto: 0,
        plazo_vto: 0,
        cant_dias_rectifica: 0,
        plazo_mes_rectifica: 0,
        tipo_pauta: 'Tipo sin descripción',
        modificable: false,
      };
    }

    return {
      pauta_id: Number(data?.pauta_id ?? 0),
      convenio_id: Number(data?.convenio_id ?? 0),
      convenio_nombre: String(data?.convenio_nombre ?? 'Convenio sin nombre'),
      descripcion: String(data?.descripcion ?? data?.pauta_descripcion ?? 'Pauta sin descripcion'),
      dia_vto: Number(data?.dia_vto ?? 0),
      plazo_vto: Number(data?.plazo_vto ?? 0),
      cant_dias_rectifica: Number(data?.cant_dias_rectifica ?? 0),
      plazo_mes_rectifica: Number(data?.plazo_mes_rectifica ?? 0),
      tipo_pauta: String(data?.tipo_pauta ?? 'Tipo sin descripción'),
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
