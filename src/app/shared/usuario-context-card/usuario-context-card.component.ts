import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';
import { MunicipioService } from '../../services/municipio.service';
import { Router } from '@angular/router';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Component({
  selector: 'app-usuario-context-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatSelectModule, MatButtonModule],
  templateUrl: './usuario-context-card.component.html',
  styleUrls: ['./usuario-context-card.component.scss']
})
export class UsuarioContextCardComponent implements OnInit {
  usuario: any;
  municipios: any[] = [];
  municipioActual: any;
  cargando = true; // 👈 controla el skeleton

  constructor(
    private auth: AuthService,
    private municipioService: MunicipioService,
    private router: Router
  ) {}

  ngOnInit() {
    this.municipioActual = this.municipioService.getMunicipioActual();
    this.auth.obtenerMisMunicipios().subscribe({
      next: (data) => {
        this.municipios = data;
        this.cargando = false; // ✅ desactiva el skeleton
      },
      error: (e) => {
        console.error(e);
        this.cargando = false;
      },
    });

    this.usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  }

  onChangeMunicipio(nuevo: any) {
    if (!nuevo || nuevo.municipio_id === this.municipioActual?.municipio_id) return;

    Swal.fire({
      title: '¿Cambiar de municipio?',
      text: 'Si estás cargando datos, podrías perder los cambios no guardados.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cambiar',
      cancelButtonText: 'Cancelar'
    }).then((result: SweetAlertResult) => {
      if (result.isConfirmed) {
        this.municipioService.setMunicipio(nuevo);
        this.router.navigate(['/home']);
        Swal.fire('Municipio cambiado', '', 'success');
      }
    });
  }

  logout() {
    localStorage.removeItem('token');
    this.municipioService.clear();
    this.router.navigate(['/login']);
  }
}
