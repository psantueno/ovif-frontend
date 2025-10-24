import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
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
