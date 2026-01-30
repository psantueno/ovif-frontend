import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, map, catchError, of, throwError, from, switchMap } from 'rxjs';
import Swal from 'sweetalert2';
import { API_URL } from '../app.config';
import {
  ModuloPauta,
  PautaTipo,
  mapTipoPautaToModulos,
  obtenerEtiquetaTipoPauta
} from '../models/pauta.model';

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

export interface ConceptoRecaudacion {
  cod_concepto: number;
  descripcion: string;
  partida_recurso_codigo: number;
  importe_recaudacion: number | null;
  importeOriginal?: number | null;
  importeTexto?: string | null;
  tieneError?: boolean;
}

export interface ConceptoRecaudacionUpsertPayload {
  cod_concepto: number;
  importe_recaudacion: number | null;
}

export interface Remuneracion {
  regimen: string;
  cuil: number;
  apellido_nombre: string;
  situacion_revista: string;
  fecha_alta: string;
  remuneracion_neta: number;
  tipo_liquidacion: string;
  bonificacion?: number;
  cant_hs_extra_50?: number;
  cant_hs_extra_100?: number;
  importe_hs_extra_50?: number;
  importe_hs_extra_100?: number;
  art?: number;
  seguro_vida?: number;
  otros_conceptos?: number;
  tieneError?: boolean;
}

export interface RemuneracionUpsertPayload {
  regimen: string;
  cuil: number;
  apellido_nombre: string;
  situacion_revista: string;
  fecha_alta: string;
  remuneracion_neta: number;
  tipo_liquidacion: string;
  bonificacion?: number;
  cant_hs_extra_50?: number;
  cant_hs_extra_100?: number;
  importe_hs_extra_50?: number;
  importe_hs_extra_100?: number;
  art?: number;
  seguro_vida?: number;
  otros_conceptos?: number;
}

export interface MunicipioSelectOption {
  municipio_id: number;
  municipio_nombre: string;
}

export interface EjercicioCerradoResponse {
  ejercicio: number;
  mes: number;
  convenio_id?: number | null;
  convenio_nombre?: string | null;
  pauta_id?: number | null;
  pauta_descripcion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin_oficial?: string | null;
  fecha_fin?: string | null;
  fecha_prorroga?: string | null;
  fecha_prorroga_vigente?: string | null;
  fecha_cierre?: string | null;
  tiene_prorroga?: boolean;
  raw?: any;
  [key: string]: unknown;
}

export interface PeriodoSeleccionadoMunicipio {
  ejercicio: number;
  mes: number;
  valor?: string;
  convenio_id?: number | null;
  convenio_nombre?: string | null;
  pauta_id?: number | null;
  pauta_descripcion?: string | null;
  tipo_pauta?: PautaTipo | null;
  tipo_pauta_label?: string | null;
  modulos?: ModuloPauta[] | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  fecha_cierre?: string | null;
}

export interface UpsertResponse {
  message: string
  resumen: {
    actualizados: number,
    creados: number,
    sinCambios: number
    errores?: string[]
  }
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

  ensureMunicipioSeleccionado(): Observable<'ok' | 'sin-municipios' | 'seleccionar'> {
    if (this.getMunicipioActual()) {
      return of('ok');
    }

    return this.getMisMunicipios().pipe(
      switchMap((municipios): Observable<'ok' | 'sin-municipios' | 'seleccionar'> => {
        if (!municipios.length) {
          this.clear();
          return of<'sin-municipios'>('sin-municipios');
        }

        if (municipios.length === 1) {
          return from(this.setMunicipio(municipios[0], { silent: true })).pipe(map(() => 'ok' as const));
        }

        this.clear();
        return of<'seleccionar'>('seleccionar');
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
          const convenioRaw = item?.convenio_id ?? item?.convenioId ?? item?.convenio ?? null;
          const pautaRaw = item?.pauta_id ?? item?.pautaId ?? null;
          const convenioNombre =
            item?.convenio_nombre ??
            item?.convenioNombre ??
            item?.convenio?.nombre ??
            null;
          const pautaDescripcion =
            item?.pauta_descripcion ??
            item?.pautaDescripcion ??
            item?.pauta?.descripcion ??
            null;

          const fechaInicioOficial =
            fechas.inicio_oficial ??
            fechas.inicioOficial ??
            datosOficiales.fecha_inicio ??
            null;
          const fechaFinOficial =
            fechas.cierre_oficial ??
            fechas.fin_oficial ??
            fechas.finOficial ??
            datosOficiales.fecha_fin ??
            null;
          const fechaInicioProrroga =
            fechas.inicio_prorroga ??
            datosProrroga.fecha_inicio ??
            null;
          const fechaFinProrroga =
            fechas.prorroga_vigente ??
            fechas.fin_prorroga ??
            datosProrroga.fecha_fin_nueva ??
            datosProrroga.fechaFinNueva ??
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
          const convenioId = Number(convenioRaw);
          const pautaId = Number(pautaRaw);

          return {
            ejercicio: Number(item?.ejercicio ?? res?.ejercicio ?? item?.anio ?? item?.year ?? 0),
            mes: Number(item?.mes ?? item?.month ?? 0),
            convenio_id: Number.isFinite(convenioId) ? convenioId : null,
            convenio_nombre: convenioNombre,
            pauta_id: Number.isFinite(pautaId) ? pautaId : null,
            pauta_descripcion: pautaDescripcion,
            fecha_inicio: fechaInicioProrroga ?? fechaInicioOficial ?? null,
            fecha_fin_oficial: fechaFinOficial,
            fecha_fin: fechaVigente,
            fecha_prorroga: fechaFinProrroga ?? null,
            fecha_prorroga_vigente: fechaFinProrroga ?? null,
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

  actualizarProrrogaMunicipio(params: {
    municipioId: number;
    ejercicio: number;
    mes: number;
    fechaFin: string | null;
    convenioId?: number | null;
    pautaId?: number | null;
    tipo?: string | null;
    motivo?: string | null;
    observaciones?: string | null;
  }): Observable<void> {
    const {
      municipioId,
      ejercicio,
      mes,
      fechaFin,
      convenioId,
      pautaId,
      tipo,
      motivo,
      observaciones
    } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para actualizar la prórroga.'));
    }

    const payload = {
      fecha_fin: fechaFin,
      convenio_id: convenioId ?? null,
      pauta_id: pautaId ?? null,
      tipo: tipo ?? null,
      motivo: motivo ?? null,
      observaciones: observaciones ?? null
    };

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

  guardarPartidasGastos(params: { municipioId: number; ejercicio: number; mes: number; partidas: PartidaGastoUpsertPayload[] }): Observable<UpsertResponse> {
    const { municipioId, ejercicio, mes, partidas } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para guardar los gastos.'));
    }

    return this.http
      .put<UpsertResponse>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/gastos`, { partidas })
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

  guardarPartidasRecursos(params: { municipioId: number; ejercicio: number; mes: number; partidas: PartidaRecursoUpsertPayload[] }): Observable<UpsertResponse> {
    const { municipioId, ejercicio, mes, partidas } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para guardar los recursos.'));
    }

    return this.http
      .put<UpsertResponse>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/recursos`, { partidas })
      .pipe(catchError((error) => throwError(() => error)));
  }

  getPeriodoSeleccionado(municipioId: number): PeriodoSeleccionadoMunicipio | null {
    if (!municipioId) {
      return null;
    }

    const periodos = this.leerPeriodosSeleccionados();
    const periodo = periodos[String(municipioId)];
    if (!periodo) {
      return null;
    }

    const normalizado = this.normalizarPeriodo(periodo);
    if (!normalizado) {
      return null;
    }

    return normalizado;
  }

  setPeriodoSeleccionado(municipioId: number, periodo: PeriodoSeleccionadoMunicipio): void {
    if (
      !municipioId ||
      !periodo?.ejercicio ||
      !periodo?.mes
    ) {
      return;
    }

    const periodos = this.leerPeriodosSeleccionados();
    const key = String(municipioId);
    const valor = periodo.valor ?? this.buildPeriodoValor(periodo);
    const tipo = periodo.tipo_pauta ?? null;
    const modulos =
      periodo.modulos && periodo.modulos.length
        ? periodo.modulos
        : tipo
          ? mapTipoPautaToModulos(tipo)
          : null;
    const tipoLabel =
      periodo.tipo_pauta_label ??
      (tipo ? obtenerEtiquetaTipoPauta(tipo) : null);

    periodos[key] = {
      ...periodo,
      valor: valor ?? periodo.valor,
      tipo_pauta: tipo,
      tipo_pauta_label: tipoLabel,
      modulos: modulos && modulos.length ? modulos : null
    };
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

  parsePeriodoValor(valor: string | null | undefined): Partial<PeriodoSeleccionadoMunicipio> | null {
    if (!valor || typeof valor !== 'string') {
      return null;
    }

    const [ejercicioStr, mesStr, pautaStr, tipoStr] = valor.split('_');
    const ejercicio = Number(ejercicioStr);
    const mes = Number(mesStr);

    if (!Number.isInteger(ejercicio) || !Number.isInteger(mes)) {
      return null;
    }

    const pautaId = pautaStr !== undefined && pautaStr !== '' ? Number(pautaStr) : null;
    const tipo = tipoStr && tipoStr !== 'na' ? tipoStr : null;

    return {
      ejercicio,
      mes,
      pauta_id: Number.isFinite(pautaId) ? Number(pautaId) : null,
      tipo_pauta: (tipo as PautaTipo | null) ?? null
    };
  }

  buildPeriodoValor(periodo: Partial<PeriodoSeleccionadoMunicipio> | null | undefined): string | null {
    if (!periodo?.ejercicio || !periodo?.mes) {
      return null;
    }

    const pautaSegment =
      periodo.pauta_id !== undefined && periodo.pauta_id !== null
        ? String(periodo.pauta_id)
        : '0';
    const tipoSegment = periodo.tipo_pauta ?? 'na';

    return `${periodo.ejercicio}_${periodo.mes}_${pautaSegment}_${tipoSegment}`;
  }

  obtenerConceptosRecaudacion(params: { municipioId: number; ejercicio: number; mes: number }): Observable<ConceptoRecaudacion[]> {
    const { municipioId, ejercicio, mes } = params;
    if (!municipioId || !ejercicio || !mes) {
      return of([]);
    }
    return this.http
      .get<ConceptoRecaudacion[]>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/recaudaciones/conceptos`)
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

  guardarConceptosRecaudacion(params: { municipioId: number; ejercicio: number; mes: number; conceptos: ConceptoRecaudacionUpsertPayload[] }): Observable<UpsertResponse> {
    const { municipioId, ejercicio, mes, conceptos } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para guardar los gastos.'));
    }

    return this.http
      .put<UpsertResponse>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/recaudaciones`, { conceptos })
      .pipe(catchError((error) => throwError(() => error)));
  }

  descargarInformeRecaudaciones(params: { municipioId: number; ejercicio: number; mes: number }): Observable<HttpResponse<Blob>> {
    const { municipioId, ejercicio, mes } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para descargar el informe de gastos.'));
    }

    return this.http.get(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/recaudaciones/informe`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  descargarInformeRemuneraciones(params: { municipioId: number; ejercicio: number; mes: number }): Observable<HttpResponse<Blob>> {
    const { municipioId, ejercicio, mes } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para descargar el informe de gastos.'));
    }

    return this.http.get(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/remuneraciones/informe`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  guardarRemuneraciones(params: { municipioId: number; ejercicio: number; mes: number; remuneraciones: RemuneracionUpsertPayload[] }): Observable<UpsertResponse> {
    const { municipioId, ejercicio, mes, remuneraciones } = params;
    if (!municipioId || !ejercicio || !mes) {
      return throwError(() => new Error('Datos insuficientes para guardar los gastos.'));
    }

    return this.http
      .put<UpsertResponse>(`${this.apiUrl}/municipios/${municipioId}/ejercicios/${ejercicio}/mes/${mes}/remuneraciones`, { remuneraciones })
      .pipe(catchError((error) => throwError(() => error)));
  }

  private leerPeriodosSeleccionados(): Record<string, PeriodoSeleccionadoMunicipio> {
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

  private escribirPeriodosSeleccionados(periodos: Record<string, PeriodoSeleccionadoMunicipio>): void {
    localStorage.setItem(this.ejercicioMesKey, JSON.stringify(periodos));
  }

  private normalizarPeriodo(periodo: PeriodoSeleccionadoMunicipio | null | undefined): PeriodoSeleccionadoMunicipio | null {
    if (!periodo) {
      return null;
    }

    const ejercicio = Number(periodo.ejercicio);
    const mes = Number(periodo.mes);
    if (!Number.isInteger(ejercicio) || !Number.isInteger(mes)) {
      return null;
    }

    const base: PeriodoSeleccionadoMunicipio = {
      ejercicio,
      mes,
      valor: periodo.valor ?? this.buildPeriodoValor(periodo) ?? undefined,
      convenio_id: periodo.convenio_id ?? null,
      convenio_nombre: periodo.convenio_nombre ?? null,
      pauta_id: periodo.pauta_id ?? null,
      pauta_descripcion: periodo.pauta_descripcion ?? null,
      tipo_pauta: periodo.tipo_pauta ?? null,
      tipo_pauta_label: periodo.tipo_pauta_label ?? null,
      modulos: Array.isArray(periodo.modulos) ? periodo.modulos : null,
      fecha_inicio: periodo.fecha_inicio ?? null,
      fecha_fin: periodo.fecha_fin ?? null
    };

    if ((!base.pauta_id || !base.tipo_pauta) && base.valor) {
      const parsed = this.parsePeriodoValor(base.valor);
      if (parsed) {
        base.pauta_id = base.pauta_id ?? (parsed.pauta_id ?? null);
        base.tipo_pauta = base.tipo_pauta ?? (parsed.tipo_pauta ?? null);
      }
    }

    if (base.tipo_pauta && (!base.modulos || base.modulos.length === 0)) {
      const modulos = mapTipoPautaToModulos(base.tipo_pauta);
      base.modulos = modulos.length ? modulos : null;
    }

    if (base.tipo_pauta && !base.tipo_pauta_label) {
      base.tipo_pauta_label = obtenerEtiquetaTipoPauta(base.tipo_pauta);
    }

    return base;
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
