import Swal, { SweetAlertResult } from 'sweetalert2';
import { BorradoContexto } from '../../models/borrado.model';
import { nombreMes } from './borrado.util';

const ETIQUETAS_MODULO: Record<string, string> = {
  gastos: 'Gastos',
  recursos: 'Recursos',
  recaudaciones: 'Recaudaciones',
  remuneraciones: 'Remuneraciones',
  'determinacion-tributaria': 'Determinación Tributaria',
};

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

export function confirmarBorrado(contexto: BorradoContexto): Promise<SweetAlertResult> {
  const esc = (s: string): string => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  };

  const moduloLabel = esc(ETIQUETAS_MODULO[contexto.modulo] ?? contexto.modulo);
  const tipoLabel = contexto.tipoCarga === 'rectificacion' ? 'Rectificación' : 'Regular';
  const mesLabel = esc(nombreMes(contexto.mes));
  const municipio = esc(contexto.municipioNombre);

  const html = `
    <p style="margin-bottom: 12px; color: #b91c1c; font-weight: 600;">
      Esta acción es <strong>irreversible</strong> y eliminará todos los datos del periodo.
    </p>
    <table style="width:100%; text-align:left; font-size:0.9rem; border-collapse:collapse;">
      <tr><td style="padding:4px 8px; color:#6b7280;">Módulo</td>
          <td style="padding:4px 8px; font-weight:600;">${moduloLabel}</td></tr>
      <tr><td style="padding:4px 8px; color:#6b7280;">Tipo</td>
          <td style="padding:4px 8px;">${tipoLabel}</td></tr>
      <tr><td style="padding:4px 8px; color:#6b7280;">Municipio</td>
          <td style="padding:4px 8px;">${municipio}</td></tr>
      <tr><td style="padding:4px 8px; color:#6b7280;">Ejercicio</td>
          <td style="padding:4px 8px;">${contexto.ejercicio}</td></tr>
      <tr><td style="padding:4px 8px; color:#6b7280;">Mes</td>
          <td style="padding:4px 8px;">${mesLabel}</td></tr>
      ${contexto.convenioNombre ? `<tr><td style="padding:4px 8px; color:#6b7280;">Convenio</td>
          <td style="padding:4px 8px;">${esc(contexto.convenioNombre)}</td></tr>` : ''}
      ${contexto.pautaDescripcion ? `<tr><td style="padding:4px 8px; color:#6b7280;">Pauta</td>
          <td style="padding:4px 8px;">${esc(contexto.pautaDescripcion)}</td></tr>` : ''}
    </table>
  `;

  return Swal.fire({
    title: '¿Borrar todos los datos?',
    html,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, borrar datos',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    reverseButtons: true,
  });
}
