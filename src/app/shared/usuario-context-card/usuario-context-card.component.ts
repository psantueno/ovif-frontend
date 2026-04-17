import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MunicipioService } from '../../services/municipio.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-usuario-context-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSelectModule, MatButtonModule],
  templateUrl: './usuario-context-card.component.html',
  styleUrls: ['./usuario-context-card.component.scss']
})
export class UsuarioContextCardComponent implements OnInit, OnDestroy {
  usuarioNombre = '';
  municipios: any[] = [];
  municipioActual: any;
  cargandoMunicipios = true;
  cerrandoSesion = false;
  colapsado = false;
  private sub?: Subscription;
  private logoutSub?: Subscription;
  private usuarioSub?: Subscription;

  constructor(
    private municipioService: MunicipioService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    this.colapsado = false;

    this.usuarioSub = this.authService.user$.subscribe((user) => {
      this.usuarioNombre = this.buildUsuarioNombre(user);
    });
    this.municipioActual = this.municipioService.getMunicipioActual();

    this.sub = this.municipioService.municipio$.subscribe((mun) => {
      this.municipioActual = mun;
    });

    this.municipioService.getMisMunicipios().subscribe({
      next: (data) => {
        this.municipios = Array.isArray(data) ? data : [];

        if (this.municipios.length > 0) {
          if (!this.municipioActual) {
            this.municipioService.setMunicipio(this.municipios[0], { silent: true });
            this.municipioActual = this.municipios[0];
          }
        } else {
          this.municipioActual = null;
          this.municipioService.clear();
        }

        this.cargandoMunicipios = false;
      },
      error: (err) => {
        console.error('Error al cargar municipios', err);
        this.cargandoMunicipios = false;
      }
    });
  }

  private buildUsuarioNombre(user: any | null): string {
    if (!user) {
      return '';
    }

    const nombre = (user?.nombre || '').trim();
    const apellido = (user?.apellido || '').trim();

    if (nombre && apellido) {
      return `${nombre} ${apellido.charAt(0)}.`;
    }

    if (nombre) {
      return nombre;
    }

    if (apellido) {
      return apellido;
    }

    if (user?.username) {
      return user.username;
    }

    if (user?.usuario) {
      return user.usuario;
    }

    return '';
  }

  onMunicipioChange(id: number) {
    const seleccionado = this.municipios.find((m) => m.municipio_id === id);
    if (!seleccionado) {
      return;
    }

    this.municipioActual = seleccionado;
    this.municipioService.setMunicipio(seleccionado);
    this.router.navigate(['/home']);
  }

  onLogout() {
    if (this.cerrandoSesion) {
      return;
    }

    this.cerrandoSesion = true;
    this.logoutSub?.unsubscribe();
    this.logoutSub = this.authService.logout().subscribe({
      next: () => {
        this.cerrandoSesion = false;
      },
      error: (err) => {
        console.error('Error al cerrar sesión', err);
        this.cerrandoSesion = false;
      }
    });
  }

  toggleColapsado() {
    this.colapsado = !this.colapsado;
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.logoutSub?.unsubscribe();
    this.usuarioSub?.unsubscribe();
  }
}
