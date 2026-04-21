import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { API_URL } from '../app.config';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  ModuloPauta,
  PautaTipoCodigo,
  mapTipoPautaToModulos as mapTipoPautaToModulosUtil,
  obtenerEtiquetaTipoPauta as obtenerEtiquetaTipoPautaUtil
} from '../models/pauta.model';
import { normalizeBlobHttpError } from '../core/http/blob-error.util';

export interface EjercicioMes {
  ejercicio: number;
  mes: number;
  fecha_inicio: string;
  fecha_fin: string;
  convenio?: string | number | boolean | null;
  pauta?: string | number | boolean | null;
  convenio_id?: number | null;
  pauta_id?: number | null;
  createdAt?: string;
  updatedAt?: string;
  tipo_pauta_id?: number | null;
  tipo_pauta_codigo?: PautaTipoCodigo | null;
  tipo_pauta_nombre?: string | null;
  tipo_pauta_descripcion?: string | null;
  tipo_pauta_label?: string | null;
  requiere_periodo_rectificar?: boolean | null;
}

export interface EjerciciosPageResponse {
  data: EjercicioMes[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateEjercicioPayload {
  ejercicio: number;
  mes: number;
  fecha_inicio: string;
  fecha_fin: string;
  convenio_id: number;
  pauta_id: number;
}

export interface UpdateEjercicioPayload {
  fecha_inicio: string;
  fecha_fin: string;
}

export interface ConvenioOption {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

export interface PautaConvenioOption {
  id: number;
  descripcion: string;
  tipo_pauta_id?: number | null;
  tipo_pauta_codigo?: PautaTipoCodigo | null;
  tipo_pauta_nombre?: string | null;
  tipo_pauta_descripcion?: string | null;
  tipo_pauta_label?: string | null;
  requiere_periodo_rectificar?: boolean | null;
}

export interface PautaConvenioParametros {
  dia_vto: number | null;
  plazo_vto: number | null;
  tipo_pauta_id?: number | null;
  tipo_pauta_codigo?: PautaTipoCodigo | null;
  tipo_pauta_nombre?: string | null;
  tipo_pauta_descripcion?: string | null;
  requiere_periodo_rectificar?: boolean | null;
  cant_dias_rectifica?: number | null;
  plazo_mes_rectifica?: number | null;
}

export interface ModuloCerrado {
  ejercicio: number;
  mes: number;
  modulo: string;
}

export interface InformesFiltrosResponse {}

export interface EjerciciosSelectOption {
  ejercicio: number;
}

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/ejercicios`;
  private readonly conveniosUrl = `${this.apiUrl}/convenios`;
  private readonly pautasConvenioUrl = `${this.apiUrl}/pautas-convenio`;

  listarEjercicios(params?: { page?: number; limit?: number; year?: number | string }): Observable<EjerciciosPageResponse> {
    const httpParams: Record<string, string> = {};
    if (params?.page) {
      httpParams['page'] = String(params.page);
    }
    if (params?.limit) {
      httpParams['limit'] = String(params.limit);
    }
    if (params?.year) {
      httpParams['year'] = String(params.year);
    }

    return this.http.get<any>(this.baseUrl, { params: httpParams }).pipe(
      map((response) => {
        if (response && Array.isArray(response.data)) {
          return {
            data: response.data.map((item: any) => this.normalizeEjercicio(item)),
            total: Number(response.total) || 0,
            page: Number(response.page) || 1,
            limit: Number(response.limit) || 12
          };
        }
        if (Array.isArray(response)) {
          return {
            data: response.map((item) => this.normalizeEjercicio(item)),
            total: response.length,
            page: 1,
            limit: response.length
          };
        }
        return { data: [], total: 0, page: 1, limit: params?.limit ?? 12 };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  obtenerFiltrosInformes(municipioId: number): Observable<ModuloCerrado[]> {
    const params: Record<string, string> = {};
    if (municipioId) {
      params['municipio_id'] = String(municipioId);
    }

    return this.http
      .get<ModuloCerrado[]>(`${this.baseUrl}/informes/filtros`, { params })
      .pipe(catchError((error) => throwError(() => error)));
  }

  descargarInformeModulo(params: { municipio_id: number; ejercicio: number; mes: number; modulo: string }): Observable<HttpResponse<Blob>> {
    const httpParams: Record<string, string> = {
      municipio_id: String(params.municipio_id),
      ejercicio: String(params.ejercicio),
      mes: String(params.mes),
      modulo: params.modulo
    };

    return this.http
      .get(`${this.baseUrl}/informes/download`, { params: httpParams, responseType: 'blob', observe: 'response' })
      .pipe(catchError((error) => normalizeBlobHttpError(error)));
  }

  crearEjercicio(payload: CreateEjercicioPayload): Observable<EjercicioMes> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => this.normalizeEjercicio(response)),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarEjercicio(ejercicio: number, mes: number, payload: UpdateEjercicioPayload): Observable<EjercicioMes> {
    return this.http.put<any>(`${this.baseUrl}/${ejercicio}/mes/${mes}`, payload).pipe(
      map((response) => this.normalizeEjercicio(response)),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarEjercicio(ejercicio: number, mes: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${ejercicio}/mes/${mes}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  listarConvenios(): Observable<ConvenioOption[]> {
    return this.http.get<any>(this.conveniosUrl).pipe(
      map((response) => {
        const lista = this.unwrapResponseArray(response);
        return lista.map((item) => this.normalizeConvenio(item));
      })
    );
  }

  listarPautasPorConvenio(convenioId: number): Observable<PautaConvenioOption[]> {
    if (!convenioId) {
      return of([]);
    }
    return this.http.get<any>(`${this.conveniosUrl}/${convenioId}/pautas`).pipe(
      map((response) => {
        const lista = this.unwrapResponseArray(response);
        return lista.map((item) => this.normalizePauta(item));
      })
    );
  }

  obtenerParametrosPauta(pautaId: number): Observable<PautaConvenioParametros> {
    return this.http.get<any>(`${this.pautasConvenioUrl}/${pautaId}`).pipe(
      map((response) => {
        const payload = this.unwrapResponseItem(response) ?? {};
        return this.normalizePautaParametros(payload);
      }),
      catchError((error) => throwError(() => error))
    );
  }

  descargarInformePDF(downloadUrl: string, municipioId: number): Observable<HttpResponse<Blob>> {
    if (!municipioId) {
      return throwError(() => new Error('Municipio no seleccionado'));
    }

    return this.http.get(`${downloadUrl}?municipio_id=${municipioId}`, {
      responseType: 'blob',
      observe: 'response',
    }).pipe(catchError((error) => normalizeBlobHttpError(error)));
  }

  listarCatalogoEjercicios(): Observable<EjerciciosSelectOption[]> {
    return this.http.get<any>(`${this.baseUrl}/select`).pipe(
      map((response) => {
        const ejercicios = this.unwrapResponseArray(response).map((item) => Number(item));
        return ejercicios.map((ejercicio) => ({ ejercicio }));
      })
    );
  }

  private normalizeEjercicio(data: any): EjercicioMes {
    const convenioNombre =
      data?.Convenio?.nombre ??
      data?.convenio_nombre ??
      data?.nombre ??
      null;
    const pautaDescripcion =
      data?.PautaConvenio?.descripcion ??
      data?.pauta_descripcion ??
      data?.descripcion ??
      null;

    const tipoPautaId = this.toOptionalNumber(
      data?.tipo_pauta_id ??
      data?.PautaConvenio?.tipo_pauta_id ??
      data?.PautaConvenio?.TipoPauta?.tipo_pauta_id
    );

    const tipoPautaCodigo = (
      data?.tipo_pauta_codigo ??
      data?.PautaConvenio?.tipo_pauta_codigo ??
      data?.PautaConvenio?.TipoPauta?.codigo ??
      null
    ) as PautaTipoCodigo | null;

    const tipoPautaNombre =
      data?.tipo_pauta_nombre ??
      data?.PautaConvenio?.tipo_pauta_nombre ??
      data?.PautaConvenio?.TipoPauta?.nombre ??
      null;

    const tipoPautaDescripcion =
      data?.tipo_pauta_descripcion ??
      data?.PautaConvenio?.tipo_pauta_descripcion ??
      data?.PautaConvenio?.TipoPauta?.descripcion ??
      null;

    const requierePeriodoRectificar = data?.requiere_periodo_rectificar ??
      data?.PautaConvenio?.requiere_periodo_rectificar ??
      data?.PautaConvenio?.TipoPauta?.requiere_periodo_rectificar ??
      null;

    return {
      ejercicio: Number(data?.ejercicio) || 0,
      mes: Number(data?.mes) || 0,
      fecha_inicio: this.toDateString(data?.fecha_inicio),
      fecha_fin: this.toDateString(data?.fecha_fin),
      convenio: convenioNombre ?? data?.convenio ?? data?.convenio_id ?? null,
      pauta: pautaDescripcion ?? data?.pauta ?? data?.pauta_id ?? null,
      convenio_id: this.toOptionalNumber(data?.convenio_id ?? data?.Convenio?.convenio_id),
      pauta_id: this.toOptionalNumber(data?.pauta_id ?? data?.PautaConvenio?.pauta_id),
      createdAt: data?.createdAt ?? data?.created_at ?? undefined,
      updatedAt: data?.updatedAt ?? data?.updated_at ?? undefined,
      tipo_pauta_id: tipoPautaId,
      tipo_pauta_codigo: tipoPautaCodigo,
      tipo_pauta_nombre: tipoPautaNombre,
      tipo_pauta_descripcion: tipoPautaDescripcion,
      tipo_pauta_label:
        tipoPautaNombre ??
        tipoPautaDescripcion ??
        obtenerEtiquetaTipoPautaUtil(tipoPautaCodigo),
      requiere_periodo_rectificar:
        requierePeriodoRectificar === null || requierePeriodoRectificar === undefined
          ? null
          : Boolean(requierePeriodoRectificar)
    };
  }

  private normalizeConvenio(data: any): ConvenioOption {
    return {
      id: Number(data?.id ?? data?.convenio_id) || 0,
      nombre: data?.nombre ?? data?.descripcion ?? 'Convenio sin nombre',
      descripcion: data?.descripcion ?? null
    };
  }

  private normalizePauta(data: any): PautaConvenioOption {
    const tipoPautaId = this.toOptionalNumber(
      data?.tipo_pauta_id ??
      data?.TipoPauta?.tipo_pauta_id
    );

    const tipoPautaCodigo = (
      data?.tipo_pauta_codigo ??
      data?.TipoPauta?.codigo ??
      null
    ) as PautaTipoCodigo | null;

    const tipoPautaNombre =
      data?.tipo_pauta_nombre ??
      data?.TipoPauta?.nombre ??
      null;

    const tipoPautaDescripcion =
      data?.tipo_pauta_descripcion ??
      data?.TipoPauta?.descripcion ??
      null;

    const requierePeriodoRectificar =
      data?.requiere_periodo_rectificar ??
      data?.TipoPauta?.requiere_periodo_rectificar ??
      null;

    return {
      id: Number(data?.id ?? data?.pauta_id) || 0,
      descripcion: data?.descripcion ?? 'Pauta sin descripción',
      tipo_pauta_id: tipoPautaId,
      tipo_pauta_codigo: tipoPautaCodigo,
      tipo_pauta_nombre: tipoPautaNombre,
      tipo_pauta_descripcion: tipoPautaDescripcion,
      tipo_pauta_label:
        tipoPautaNombre ??
        tipoPautaDescripcion ??
        obtenerEtiquetaTipoPautaUtil(tipoPautaCodigo),
      requiere_periodo_rectificar:
        requierePeriodoRectificar === null || requierePeriodoRectificar === undefined
          ? null
          : Boolean(requierePeriodoRectificar)
    };
  }

  private normalizePautaParametros(data: any): PautaConvenioParametros {
    const tipoPautaCodigo = (data?.tipo_pauta_codigo ?? null) as PautaTipoCodigo | null;
    const tipoPautaNombre = data?.tipo_pauta_nombre ?? null;
    const tipoPautaDescripcion = data?.tipo_pauta_descripcion ?? null;
    const requierePeriodoRectificar = data?.requiere_periodo_rectificar;

    return {
      dia_vto: this.toOptionalNumber(data?.dia_vto),
      plazo_vto: this.toOptionalNumber(data?.plazo_vto),
      tipo_pauta_id: this.toOptionalNumber(data?.tipo_pauta_id),
      tipo_pauta_codigo: tipoPautaCodigo,
      tipo_pauta_nombre: tipoPautaNombre,
      tipo_pauta_descripcion: tipoPautaDescripcion,
      requiere_periodo_rectificar:
        requierePeriodoRectificar === null || requierePeriodoRectificar === undefined
          ? null
          : Boolean(requierePeriodoRectificar),
      cant_dias_rectifica: this.toOptionalNumber(data?.cant_dias_rectifica),
      plazo_mes_rectifica: this.toOptionalNumber(data?.plazo_mes_rectifica)
    };
  }

  private unwrapResponseArray(response: any): any[] {
    if (Array.isArray(response?.data)) {
      return response.data;
    }
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  }

  private unwrapResponseItem(response: any): any | null {
    if (response?.data && typeof response.data === 'object') {
      return response.data;
    }
    if (response && typeof response === 'object') {
      return response;
    }
    return null;
  }

  private toOptionalNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  private toDateString(value: any): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      const [datePart] = value.split('T');
      if (datePart) {
        return datePart;
      }
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }

    return '';
  }

  mapTipoPautaToModulos(tipo: PautaTipoCodigo | null | undefined): ModuloPauta[] {
    return mapTipoPautaToModulosUtil(tipo);
  }

  filtrarEjerciciosPorTipoPauta(
    ejercicios: EjercicioMes[],
    tipo: PautaTipoCodigo | null | undefined
  ): EjercicioMes[] {
    if (!tipo) {
      return ejercicios;
    }
    return ejercicios.filter((item) => (item.tipo_pauta_codigo ?? null) === tipo);
  }

  obtenerEtiquetaTipoPauta(tipo: PautaTipoCodigo | null | undefined): string | null {
    return obtenerEtiquetaTipoPautaUtil(tipo);
  }
}
