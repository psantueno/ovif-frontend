import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../app.config' 
import { Observable } from 'rxjs';


export interface Usuario {
  usuario_id?: number;
  usuario: string;
  email: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  municipios?: number[];
}

export interface UsuarioToggleResponse {
  message: string;
  user: Usuario;
}


@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  // 🔹 Obtener usuarios con filtros y paginación
  getUsuarios(params: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/usuarios`, { params });
  }

  // 🔹 Obtener lista de municipios (solo id + nombre)
  getMunicipios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/municipios/select`);
  }

  // 🔹 Obtener lista de roles (solo id + nombre)
  getRoles(): Observable<any> {
    return this.http.get(`${this.apiUrl}/roles/select`);
  }

  toggleUsuarioActivo(id: number): Observable<UsuarioToggleResponse> {
    return this.http.patch<UsuarioToggleResponse>(
      `${this.apiUrl}/usuarios/${id}/toggle`,
      {}
    );
  }

}
