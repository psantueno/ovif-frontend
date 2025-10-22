import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, catchError, of } from 'rxjs';
import Swal from 'sweetalert2';
import { API_URL } from '../app.config';

@Injectable({ providedIn: 'root' })
export class MunicipioService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'municipioSeleccionado';
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
