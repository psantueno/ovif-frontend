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

  // 🔹 Obtener municipios asignados a un usuario específico
  getMunicipiosPorUsuario(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios/${id}/municipios`);
  }

  // 🔹 Actualizar la asignación de municipios del usuario
  actualizarMunicipiosUsuario(id: number, municipios: number[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/usuarios/${id}/municipios`, { municipios });
  }

  // Crear usuario
  createUsuario(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/usuarios`, data);
  }

  // Actualizar usuario
  updateUsuario(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/usuarios/${id}`, data);
  }

  // Eliminar usuario permanentemente con verificacion previa de registros.
  deleteUsuario(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/usuarios/${id}`);
  }

}
