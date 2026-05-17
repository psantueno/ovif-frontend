import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import Swal from 'sweetalert2';
import { RemuneracionesComponent } from '../remuneraciones.component';
import { AuthService } from '../../../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RemuneracionesPendingChangesGuard implements CanDeactivate<RemuneracionesComponent> {
  constructor(private readonly authService: AuthService) {}

  canDeactivate(component: RemuneracionesComponent): boolean | Promise<boolean> {
    if (
      this.authService.isSessionDead ||
      this.authService.isLoggingOut ||
      !component.tieneCambiosPendientes()
    ) {
      return true;
    }

    return Swal.fire({
      icon: 'warning',
      title: '¿Salir sin guardar?',
      text: 'Tenés un archivo cargado que no fue enviado. ¿Deseás salir de todos modos?',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    }).then((result) => result.isConfirmed);
  }
}
