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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import Swal from 'sweetalert2';

import { UsuariosService, Usuario } from '../../../services/usuarios.service';
import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';

interface RolOption {
  rol_id: number;
  nombre: string;
  descripcion?: string;
}

@Component({
  selector: 'app-roles',
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
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    AdminNavbarComponent
  ],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent implements OnInit {
  filtroForm: FormGroup;
  usuarios: Usuario[] = [];
  roles: RolOption[] = [];

  rolesAsignados = new Set<number>();

  busquedaEjecutada = false;
  cargandoUsuarios = false;
  cargandoRolesCatalogo = false;
  cargandoRolesAsignados = false;
  guardandoRoles = false;

  selectedUsuario: Usuario | null = null;

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Roles y permisos' }
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
    this.cargarRoles();
  }

  buscarUsuarios(): void {
    const termino = (this.filtroForm.value.search || '').trim();

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
    this.rolesAsignados.clear();

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
    this.rolesAsignados.clear();
    this.cargarRolesUsuario(usuario.usuario_id);
  }

  guardarRoles(): void {
    if (!this.selectedUsuario?.usuario_id || this.cargandoRolesAsignados) {
      return;
    }

    const rolesSeleccionados = Array.from(this.rolesAsignados);

    this.guardandoRoles = true;

    this.usuariosService.actualizarRolesUsuario(this.selectedUsuario.usuario_id, rolesSeleccionados).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Roles actualizados',
          text: 'Los roles del usuario fueron actualizados correctamente.',
          timer: 2000,
          showConfirmButton: false
        });

        if (Array.isArray((this.selectedUsuario as any).Roles)) {
          const rolesActualizados = rolesSeleccionados
            .map((rolId: number) => this.roles.find((rol: RolOption) => rol.rol_id === rolId))
            .filter((rol: RolOption | undefined): rol is RolOption => Boolean(rol));

          (this.selectedUsuario as any).Roles = rolesActualizados;
        }
      },
      error: (err) => {
        console.error('Error al actualizar roles', err);
        Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: 'Revisa tu conexión e intenta nuevamente.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      },
      complete: () => {
        this.guardandoRoles = false;
      }
    });
  }

  toggleRol(change: MatCheckboxChange, rolId: number): void {
    if (change.checked) {
      this.rolesAsignados.add(rolId);
    } else {
      this.rolesAsignados.delete(rolId);
    }
  }

  rolSeleccionado(rolId: number): boolean {
    return this.rolesAsignados.has(rolId);
  }

  seleccionarTodosRoles(): void {
    if (this.cargandoRolesCatalogo || this.cargandoRolesAsignados || this.roles.length === 0) {
      return;
    }

    this.rolesAsignados = new Set(this.roles.map((rol) => rol.rol_id));
  }

  limpiarSeleccionRoles(): void {
    if (this.cargandoRolesAsignados) {
      return;
    }

    this.rolesAsignados = new Set();
  }

  private cargarRoles(): void {
    this.cargandoRolesCatalogo = true;

    this.usuariosService.getRoles().subscribe({
      next: (res) => {
        if (Array.isArray(res) && res.length > 0) {
          this.roles = res
            .map((rol: any) => ({
              rol_id: Number(rol.rol_id ?? rol.id ?? 0),
              nombre: rol.nombre ?? rol.descripcion ?? 'Sin nombre',
              descripcion: rol.descripcion ?? rol.detalle ?? ''
            }))
            .filter((rol: RolOption) => Boolean(rol.nombre) && !Number.isNaN(rol.rol_id));

          this.rolesAsignados = new Set(
            Array.from(this.rolesAsignados).filter((rolId) =>
              this.roles.some((rol) => rol.rol_id === rolId)
            )
          );
        } else {
          this.roles = [
            { rol_id: 1, nombre: 'Administrador', descripcion: 'Acceso total al sistema' },
            { rol_id: 2, nombre: 'Operador', descripcion: 'Gestión operativa de módulos asignados' }
          ];
          this.rolesAsignados = new Set();
        }
      },
      error: (err) => {
        console.error('Error al cargar roles', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar roles',
          text: 'No fue posible obtener el catálogo de roles.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
        this.roles = [
          { rol_id: 1, nombre: 'Administrador', descripcion: 'Acceso total al sistema' },
          { rol_id: 2, nombre: 'Operador', descripcion: 'Gestión operativa de módulos asignados' }
        ];
        this.rolesAsignados = new Set();
      },
      complete: () => {
        this.cargandoRolesCatalogo = false;
      }
    });
  }

  private cargarRolesUsuario(usuarioId: number): void {
    this.cargandoRolesAsignados = true;

    this.usuariosService.getRolesPorUsuario(usuarioId).subscribe({
      next: (res) => {
        const payload = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.roles)
            ? (res as any).roles
            : [];

        const rolesIds = payload
          .map((rol: any) => {
            if (typeof rol === 'number') {
              return Number(rol);
            }

            if (rol && typeof rol === 'object') {
              if ('rol_id' in rol) {
                return Number((rol as any).rol_id);
              }
              if ('id' in rol) {
                return Number((rol as any).id);
              }
            }

            return NaN;
          })
          .filter((rolId: number) => !Number.isNaN(rolId));

        this.rolesAsignados = new Set(rolesIds);
        this.cargandoRolesAsignados = false;
      },
      error: (err) => {
        if (err?.status === 404) {
          this.rolesAsignados = new Set();
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'El usuario aún no tiene roles asignados.',
            showConfirmButton: false,
            timer: 2500
          });
        } else {
          console.error('Error al obtener roles del usuario', err);
          Swal.fire({
            icon: 'error',
            title: 'Error al cargar roles',
            text: 'No pudimos obtener los roles actuales del usuario.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
          });
        }

        this.cargandoRolesAsignados = false;
      }
    });
  }
}
