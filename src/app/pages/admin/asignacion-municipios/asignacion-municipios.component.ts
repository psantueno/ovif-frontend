import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Swal from 'sweetalert2';

import { UsuariosService, Usuario } from '../../../services/usuarios.service';
import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';

interface MunicipioOption {
  municipio_id: number;
  municipio_nombre: string;
}

@Component({
  selector: 'app-asignacion-municipios',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    AdminNavbarComponent
  ],
  templateUrl: './asignacion-municipios.component.html',
  styleUrls: ['./asignacion-municipios.component.scss']
})
export class AsignacionMunicipiosComponent implements OnInit {
  filtroForm: FormGroup;
  usuarios: Usuario[] = [];
  busquedaEjecutada = false;

  selectedUsuario: Usuario | null = null;
  municipios: MunicipioOption[] = [];
  municipiosAsignados = new Set<number>();

  cargandoUsuarios = false;
  cargandoAsignaciones = false;
  guardandoAsignacion = false;

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Asignación de municipios' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly usuariosService: UsuariosService
  ) {
    this.filtroForm = this.fb.group({
      search: ['']
    });
  }

  ngOnInit(): void {
    this.cargarMunicipios();
  }

  buscarUsuarios(): void {
    const filtros = this.filtroForm.value;
    const termino = filtros.search?.trim() || '';

    if (!termino) {
      Swal.fire({
        icon: 'info',
        title: 'Ingrese un criterio',
        text: 'Escriba parte del usuario, nombre o email para realizar la búsqueda.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    this.cargandoUsuarios = true;
    this.busquedaEjecutada = true;
    this.selectedUsuario = null;
    this.municipiosAsignados.clear();

    this.usuariosService.getUsuarios({
      pagina: '1',
      limite: '10',
      search: termino
    }).subscribe({
      next: (res: any) => {
        this.usuarios = Array.isArray(res?.data) ? res.data : [];
        if (this.usuarios.length === 0) {
          Swal.fire({
            icon: 'warning',
            title: 'Sin resultados',
            text: 'No se encontraron usuarios con el término buscado.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#3085d6'
          });
        }
      },
      error: (err) => {
        console.error('Error al buscar usuarios', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al buscar',
          text: 'No pudimos obtener los usuarios. Intente nuevamente más tarde.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      },
      complete: () => {
        this.cargandoUsuarios = false;
      }
    });
  }

  seleccionarUsuario(usuario: Usuario): void {
    if (!usuario.usuario_id) {
      return;
    }

    if (this.selectedUsuario?.usuario_id === usuario.usuario_id) {
      return;
    }

    this.selectedUsuario = usuario;
    this.municipiosAsignados.clear();
    this.cargandoAsignaciones = true;

    this.usuariosService.getMunicipiosPorUsuario(usuario.usuario_id).subscribe({
      next: (res) => {
        const ids = Array.isArray(res)
          ? res.map((item: any) => {
              if (typeof item === 'number') {
                return item;
              }
              if (item && typeof item === 'object') {
                if ('municipio_id' in item) {
                  return Number(item.municipio_id);
                }
                if ('id' in item) {
                  return Number(item.id);
                }
              }
              return NaN;
            }).filter((id: number) => !Number.isNaN(id))
          : [];

        ids.forEach((id: number) => this.municipiosAsignados.add(id));
      },
      error: (err) => {
        console.error('Error al obtener municipios del usuario', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar asignación',
          text: 'No pudimos obtener los municipios actuales del usuario.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      },
      complete: () => {
        this.cargandoAsignaciones = false;
      }
    });
  }

  toggleMunicipio(change: MatCheckboxChange, municipioId: number): void {
    if (change.checked) {
      this.municipiosAsignados.add(municipioId);
    } else {
      this.municipiosAsignados.delete(municipioId);
    }
  }

  seleccionarTodos(): void {
    this.municipios.forEach((m) => this.municipiosAsignados.add(m.municipio_id));
  }

  limpiarSeleccion(): void {
    this.municipiosAsignados.clear();
  }

  guardarAsignacion(): void {
    if (!this.selectedUsuario?.usuario_id) {
      return;
    }

    this.guardandoAsignacion = true;
    const municipios = Array.from(this.municipiosAsignados);

    // 🧩 LOG: ver qué se está mandando al backend
  console.log('📦 Enviando body al backend:', {
    municipios,
    usuarioId: this.selectedUsuario.usuario_id
  });

    this.usuariosService.actualizarMunicipiosUsuario(this.selectedUsuario.usuario_id, municipios).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Asignación guardada',
          text: 'Los municipios fueron actualizados correctamente.',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('Error al guardar asignación', err);
        Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: 'Revisa tu conexión e intenta nuevamente.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      },
      complete: () => {
        this.guardandoAsignacion = false;
      }
    });
  }

  private cargarMunicipios(): void {
    this.usuariosService.getMunicipios().subscribe({
      next: (res) => {
        this.municipios = Array.isArray(res)
          ? res.map((item: any) => ({
              municipio_id: Number(item.municipio_id ?? item.id ?? 0),
              municipio_nombre: item.municipio_nombre ?? item.nombre ?? 'Sin nombre'
            })).filter((m) => !Number.isNaN(m.municipio_id))
          : [];
      },
      error: (err) => {
        console.error('Error al cargar municipios', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar municipios',
          text: 'No fue posible obtener el catálogo de municipios.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  municipioSeleccionado(id: number): boolean {
    return this.municipiosAsignados.has(id);
  }
}
