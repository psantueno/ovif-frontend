import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import Swal from 'sweetalert2';
import { GastosComponent } from '../gastos.component';

@Injectable({ providedIn: 'root' })
export class PendingChangesGuard implements CanDeactivate<GastosComponent> {
  canDeactivate(component: GastosComponent): boolean | Promise<boolean> {
    if (!component.tieneCambiosPendientes()) {
      return true;
    }

    return Swal.fire({
      icon: 'warning',
      title: '¿Salir sin guardar?',
      text: 'Perderás todos los cambios que no hayan sido guardados. ¿Deseás continuar?',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    }).then((result) => result.isConfirmed);
  }
}
