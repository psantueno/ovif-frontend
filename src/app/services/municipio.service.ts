import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MunicipioService {
  private municipioSeleccionadoSubject = new BehaviorSubject<any | null>(
    JSON.parse(localStorage.getItem('municipioSeleccionado') || 'null')
  );
  municipioSeleccionado$ = this.municipioSeleccionadoSubject.asObservable();

  setMunicipio(municipio: any) {
    localStorage.setItem('municipioSeleccionado', JSON.stringify(municipio));
    this.municipioSeleccionadoSubject.next(municipio);
  }

  getMunicipioActual() {
    return this.municipioSeleccionadoSubject.value;
  }

  clear() {
    localStorage.removeItem('municipioSeleccionado');
    this.municipioSeleccionadoSubject.next(null);
  }
}
