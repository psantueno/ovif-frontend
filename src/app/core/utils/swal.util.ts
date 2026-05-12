import Swal, { SweetAlertResult } from 'sweetalert2';

export function confirmarEliminacion(titulo: string, texto: string): Promise<SweetAlertResult> {
  return Swal.fire({
    title: titulo,
    text: texto,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d'
  });
}

export function mostrarToastExito(titulo: string, message: string = ''): void {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: titulo,
    text: message,
    showConfirmButton: false,
    timer: 5000,
    timerProgressBar: true,
    background: '#f0fdf4',
    color: '#14532d'
  });
}

export function mostrarToastError(titulo: string, message: string = ''): void {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'error',
    title: titulo,
    text: message,
    showConfirmButton: false,
    timer: 5000,
    timerProgressBar: true,
    background: '#fee2e2',
    color: '#7f1d1d'
  });
}

export function mostrarToastWarning(titulo: string, message: string = ''): void {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'warning',
    title: titulo,
    text: message,
    showConfirmButton: false,
    timer: 5000,
    timerProgressBar: true,
    background: '#fef3c7',
    color: '#78350f'
  });
}
