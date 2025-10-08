import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class MunicipioService {
  private readonly storageKey = 'municipioSeleccionado';
  private readonly municipioSubject = new BehaviorSubject<any>(this.readFromStorage());
  readonly municipio$ = this.municipioSubject.asObservable();

  constructor(private http: HttpClient) {}

  private readFromStorage(): any {
    const guardado = localStorage.getItem(this.storageKey);
    if (!guardado) {
      return null;
    }

    try {
      return JSON.parse(guardado);
    } catch (error) {
      console.warn('No se pudo parsear el municipio guardado', error);
      return null;
    }
  }

  getMunicipioActual() {
    return this.municipioSubject.value;
  }

  setMunicipio(municipio: any, options?: { silent?: boolean }) {
    this.municipioSubject.next(municipio);
    localStorage.setItem(this.storageKey, JSON.stringify(municipio));

    if (!options?.silent) {
      Swal.fire({
        title: 'Municipio cambiado',
        text: `Ahora estás viendo datos de ${municipio.municipio_nombre}`,
        icon: 'info',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
        timer: 2000,
        showConfirmButton: false
      });
    }
  }

  clear() {
    this.municipioSubject.next(null);
    localStorage.removeItem(this.storageKey);
  }

  getMisMunicipios() {
    return this.http.get<any[]>('/api/usuarios/me/municipios');
  }
}
