import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, map, catchError, of, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { API_URL } from '../app.config';

export interface PartidaGastoResponse {
  partidas_gastos_codigo: number;
  partidas_gastos_descripcion: string;
  partidas_gastos_padre?: number | null;
  partidas_gastos_carga?: number | boolean;
  gastos_importe_devengado?: number | string | null;
  importe_devengado?: number | string | null;
  children?: PartidaGastoResponse[];
  puede_cargar?: boolean;
}

export interface PartidaGastoUpsertPayload {
  partidas_gastos_codigo: number;
  gastos_importe_devengado: number | null;
}

export interface PartidaRecursoResponse {
  partidas_recursos_codigo: number;
  partidas_recursos_descripcion: string;
  partidas_recursos_padre?: number | null;
  partidas_recursos_carga?: number | boolean;
  partidas_recursos_sl?: number | boolean;
  recursos_importe_percibido?: number | string | null;
  recursos_cantidad_contribuyentes?: number | string | null;
  recursos_cantidad_pagaron?: number | string | null;
  puede_cargar?: boolean;
  children?: PartidaRecursoResponse[];
}

export interface PartidaRecursoUpsertPayload {
  partidas_recursos_codigo: number;
  recursos_importe_percibido: number | null;
  recursos_cantidad_contribuyentes: number | null;
  recursos_cantidad_pagaron: number | null;
}

export interface MunicipioSelectOption {
  municipio_id: number;
  municipio_nombre: string;
}

export interface EjercicioCerradoResponse {
  ejercicio: number;
  mes: number;
  fecha_inicio?: string | null;
  fecha_fin_oficial?: string | null;
  fecha_fin?: string | null;
  fecha_prorroga?: string | null;
  fecha_cierre?: string | null;
  tiene_prorroga?: boolean;
  raw?: any;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class MunicipioService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'municipioSeleccionado';
  private readonly ejercicioMesKey = 'ejercicioMesSeleccionado';
  private readonly municipioSubject = new BehaviorSubject<any>(this.readFromStorage());
  readonly municipio$ = this.municipioSubject.asObservable();

  private readFromStorage(): any {
    const guardado = localStorage.getItem(this.storageKey);
    if (!guardado) return null;
    try {
      return JSON.parse(guardado);
    } catch {
      console.warn('No se pudo parsear el municipio guardado');
      return null;
    }
  }

  getMunicipioActual() {
    return this.municipioSubject.value;
  }

  getEjerciciosDisponibles(municipioId: number): Observable<any[]> {
    if (!municipioId) {
      return of([]);
    }

    return this.http.get<any>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/disponibles`).pipe(
      map((res) => Array.isArray(res?.ejercicios) ? res.ejercicios : []),
      catchError((err) => {
        console.error('Error obteniendo ejercicios disponibles:', err);
        return of([]);
      })
    );
  }


  setMunicipio(municipio: any, options?: { silent?: boolean }): Promise<void> {
    const aplicarSeleccion = () => {
      this.municipioSubject.next(municipio);
      localStorage.removeItem(this.ejercicioMesKey);
      localStorage.setItem(this.storageKey, JSON.stringify(municipio));
    };

    if (options?.silent) {
      aplicarSeleccion();
      return Promise.resolve();
    }

    this.blurActiveElement();

    return Swal.fire({
      title: 'Cambiaste de municipio',
      text: `Ahora vas a gestionar la carga de datos de ${municipio.municipio_nombre}. Serás redirigido al menu principal para continuar.`,
      icon: 'info',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#3085d6',
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(() => {
      aplicarSeleccion();
    });
  }


  clear() {
    this.municipioSubject.next(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.ejercicioMesKey);
  }


  getMisMunicipios() {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios/me/municipios`).pipe(
      map((res) => Array.isArray(res) ? res : []),
      catchError((err) => {
        console.error('Error en getMisMunicipios:', err);
        return of([]);
      })
    );
  }

  getCatalogoMunicipios(): Observable<MunicipioSelectOption[]> {
    return this.http.get<any>(`${this.apiUrl}/municipios/select`).pipe(
      map((res) => {
        const raw = Array.isArray(res)
          ? res
          : Array.isArray(res?.municipios)
            ? res.municipios
            : [];

        return raw
          .map((item: any) => ({
            municipio_id: Number(item?.municipio_id ?? item?.id ?? 0),
            municipio_nombre: String(item?.municipio_nombre ?? item?.nombre ?? '').trim()
          }))
          .filter((item: MunicipioSelectOption) => Number.isInteger(item.municipio_id) && item.municipio_id > 0);
      }),
      catchError((err) => {
        console.error('Error obteniendo catálogo de municipios:', err);
        return of([]);
      })
    );
  }

  getEjerciciosCerradosMunicipio(params: { municipioId: number; anio?: number }): Observable<EjercicioCerradoResponse[]> {
    const { municipioId, anio } = params;
    if (!municipioId) {
      return of([]);
    }

    const url = `${this.apiUrl}/municipios/${municipioId}/ejercicios/cerrados`;
    const options = anio ? { params: new HttpParams().set('anio', String(anio)) } : {};

    return this.http.get<any>(url, options).pipe(
      map((res) => {
        const cierres = Array.isArray(res?.cierres)
          ? res.cierres
          : Array.isArray(res)
            ? res
            : [];

        return cierres.map((item: any) => {
          const fechas = item?.fechas ?? {};
          const datosOficiales = item?.datosOficiales ?? {};
          const datosProrroga = item?.prorroga ?? {};
          const cierreInfo = item?.cierre ?? {};

          const fechaInicioOficial =
            fechas.inicio_oficial ??
            datosOficiales.fecha_inicio ??
            null;
          const fechaFinOficial =
            fechas.fin_oficial ??
            datosOficiales.fecha_fin ??
            null;
          const fechaInicioProrroga =
            fechas.inicio_prorroga ??
            datosProrroga.fecha_inicio ??
            null;
          const fechaFinProrroga =
            fechas.fin_prorroga ??
            datosProrroga.fecha_fin ??
            null;
          const fechaVigente =
            fechas.fin_vigente ??
            fechaFinProrroga ??
            fechaFinOficial ??
            null;
          const fechaCierre =
            fechas.fecha_cierre ??
            cierreInfo.fecha ??
            null;

          return {
            ejercicio: Number(item?.ejercicio ?? res?.ejercicio ?? item?.anio ?? item?.year ?? 0),
            mes: Number(item?.mes ?? item?.month ?? 0),
            fecha_inicio: fechaInicioProrroga ?? fechaInicioOficial ?? null,
            fecha_fin_oficial: fechaFinOficial,
            fecha_fin: fechaVigente,
            fecha_prorroga: fechaFinProrroga ?? null,
            fecha_cierre: fechaCierre,
            tiene_prorroga: Boolean(item?.tiene_prorroga ?? fechaFinProrroga),
            raw: item
          };
        });
      }),
      catchError((err) => {
        console.error('Error obteniendo ejercicios cerrados del municipio:', err);
        return of([]);
      })
    );
  }

  actualizarProrrogaMunicipio(params: { municipioId: number; ejercicio: number; mes: number; fechaFin: string | null }): Observable<void> {
    const { municipioId, ejercicio, mes, fechaFin } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para actualizar la prórroga.'));
    }

    const payload = { fecha_fin: fechaFin };

    return this.http
      .put<void>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/prorroga`, payload)
      .pipe(catchError((error) => throwError(() => error)));
  }

  obtenerPartidasGastos(params: { municipioId: number; ejercicio: number; mes: number }): Observable<PartidaGastoResponse[]> {
    const { municipioId, ejercicio, mes } = params;
    if (!municipioId || !ejercicio || !mes) {
      return of([]);
    }

    return this.http
      .get<PartidaGastoResponse[] | null | undefined>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/gastos/partidas`)
      .pipe(
        map((response) => {
          if (!response) {
            return [];
          }
          return Array.isArray(response) ? response : [];
        }),
        catchError((error) => throwError(() => error))
      );
  }


  descargarInformeGastos(params: { municipioId: number; ejercicio: number; mes: number }): Observable<HttpResponse<Blob>> {
    const { municipioId, ejercicio, mes } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para descargar el informe de gastos.'));
    }

    return this.http.get(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/gastos/informe`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  guardarPartidasGastos(params: { municipioId: number; ejercicio: number; mes: number; partidas: PartidaGastoUpsertPayload[] }): Observable<void> {
    const { municipioId, ejercicio, mes, partidas } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para guardar los gastos.'));
    }

    return this.http
      .put<void>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/gastos`, { partidas })
      .pipe(catchError((error) => throwError(() => error)));
  }

  obtenerPartidasRecursos(params: { municipioId: number; ejercicio: number; mes: number }): Observable<PartidaRecursoResponse[]> {
    const { municipioId, ejercicio, mes } = params;
    if (!municipioId || !ejercicio || !mes) {
      return of([]);
    }

    return this.http
      .get<PartidaRecursoResponse[] | null | undefined>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/recursos/partidas`)
      .pipe(
        map((response) => {
          if (!response) {
            return [];
          }
          return Array.isArray(response) ? response : [];
        }),
        catchError((error) => throwError(() => error))
      );
  }

  descargarInformeRecursos(params: { municipioId: number; ejercicio: number; mes: number }): Observable<HttpResponse<Blob>> {
    const { municipioId, ejercicio, mes } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para descargar el informe de recursos.'));
    }

    return this.http.get(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/recursos/informe`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  guardarPartidasRecursos(params: { municipioId: number; ejercicio: number; mes: number; partidas: PartidaRecursoUpsertPayload[] }): Observable<void> {
    const { municipioId, ejercicio, mes, partidas } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para guardar los recursos.'));
    }

    return this.http
      .put<void>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/recursos`, { partidas })
      .pipe(catchError((error) => throwError(() => error)));
  }

  getPeriodoSeleccionado(municipioId: number): { ejercicio: number; mes: number } | null {
    if (!municipioId) {
      return null;
    }

    const periodos = this.leerPeriodosSeleccionados();
    const periodo = periodos[String(municipioId)];
    if (!periodo) {
      return null;
    }

    const ejercicio = Number(periodo.ejercicio);
    const mes = Number(periodo.mes);
    if (!Number.isInteger(ejercicio) || !Number.isInteger(mes)) {
      return null;
    }

    return { ejercicio, mes };
  }

  setPeriodoSeleccionado(municipioId: number, periodo: { ejercicio: number; mes: number }): void {
    if (!municipioId || !periodo?.ejercicio || !periodo?.mes) {
      return;
    }

    const periodos = this.leerPeriodosSeleccionados();
    periodos[String(municipioId)] = { ejercicio: periodo.ejercicio, mes: periodo.mes };
    this.escribirPeriodosSeleccionados(periodos);
  }

  clearPeriodoSeleccionado(municipioId: number): void {
    if (!municipioId) {
      return;
    }

    const periodos = this.leerPeriodosSeleccionados();
    const key = String(municipioId);
    if (!(key in periodos)) {
      return;
    }

    delete periodos[key];
    if (Object.keys(periodos).length) {
      this.escribirPeriodosSeleccionados(periodos);
    } else {
      localStorage.removeItem(this.ejercicioMesKey);
    }
  }

  private leerPeriodosSeleccionados(): Record<string, { ejercicio: number; mes: number }> {
    const almacenado = localStorage.getItem(this.ejercicioMesKey);
    if (!almacenado) {
      return {};
    }

    try {
      const parsed = JSON.parse(almacenado);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      console.warn('No se pudo parsear los periodos guardados');
      return {};
    }
  }

  private escribirPeriodosSeleccionados(periodos: Record<string, { ejercicio: number; mes: number }>): void {
    localStorage.setItem(this.ejercicioMesKey, JSON.stringify(periodos));
  }

  private blurActiveElement(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }
  }
}
