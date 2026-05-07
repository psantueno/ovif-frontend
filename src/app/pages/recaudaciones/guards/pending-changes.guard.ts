import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import Swal from 'sweetalert2';
import { RecaudacionesComponent } from '../recaudaciones.component';

@Injectable({ providedIn: 'root' })
export class RecaudacionesPendingChangesGuard implements CanDeactivate<RecaudacionesComponent> {
  canDeactivate(component: RecaudacionesComponent): boolean | Promise<boolean> {
    if (!component.tieneCambiosPendientes()) {
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
