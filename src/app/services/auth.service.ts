import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../app.config';
import Swal from 'sweetalert2'; // 👈 asegurate de tenerlo importado

@Injectable({ providedIn: 'root' })

export class AuthService {
  private apiUrl = inject(API_URL);
  private http = inject(HttpClient);
  private router = inject(Router);

  private user: any = null;

  login(usuario: string, password: string): Observable<any> {
    return new Observable((observer) => {
      this.http
        .post(`${this.apiUrl}/auth/login`, { usuario, password })
        .subscribe({
          next: (res: any) => {
            localStorage.removeItem('municipioSeleccionado');
            this.user = res.user;
            localStorage.setItem('token', res.token);
            localStorage.setItem('user', JSON.stringify(res.user));
            this.router.navigate(['/']); // selección de municipio
            observer.next(res);
            observer.complete();
          },
          error: (err) => {
            console.error('❌ Error en login:', err);

            if (err.status === 403 && err.error?.code === 'USER_DISABLED') {
              Swal.fire({
                icon: 'warning',
                title: 'Usuario deshabilitado',
                text: err.error.error || 'Tu cuenta se encuentra deshabilitada. Contactá al administrador.',
                confirmButtonColor: '#2b3e4c',
              });
            } else if (err.status === 401) {
              Swal.fire({
                icon: 'error',
                title: 'Credenciales inválidas',
                text: err.error.error || 'Usuario o contraseña incorrectos.',
                confirmButtonColor: '#2b3e4c',
              });
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Error en el inicio de sesión',
                text: 'Ocurrió un error inesperado. Intentalo nuevamente.',
                confirmButtonColor: '#2b3e4c',
              });
            }

            observer.error(err);
          },
        });
    });
  }


  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('municipioSeleccionado');
        this.router.navigate(['/login']);
      })
    );
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/change-password`, { oldPassword, newPassword });
  }

  profile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/profile`);
  }

  obtenerMisMunicipios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios/me/municipios`);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getUser() {
    return this.user || JSON.parse(localStorage.getItem('user') || 'null');
  }
}
