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
  const tipoLabel = esc(contexto.tipoCarga === 'rectificacion' ? 'Rectificación' : 'Regular');
  const mesLabel = esc(nombreMes(contexto.mes));
  const municipio = esc(contexto.municipioNombre);
  const row = (label: string, value: string | number): string => `
    <tr>
      <th scope="row">${esc(label)}</th>
      <td>${value}</td>
    </tr>
  `;

  const html = `
    <p class="swal-borrado-alerta">
      Esta acción es <strong>irreversible</strong> y eliminará todos los datos del periodo.
    </p>
    <div class="swal-borrado-periodo" aria-label="Datos del periodo">
      <table>
        <tbody>
          ${row('Módulo', moduloLabel)}
          ${row('Tipo de carga', tipoLabel)}
          ${row('Municipio', municipio)}
          ${row('Ejercicio', contexto.ejercicio)}
          ${row('Mes', mesLabel)}
          ${contexto.convenioNombre ? row('Convenio', esc(contexto.convenioNombre)) : ''}
          ${contexto.pautaDescripcion ? row('Pauta', esc(contexto.pautaDescripcion)) : ''}
        </tbody>
      </table>
    </div>
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
    customClass: {
      popup: 'swal-borrado-popup',
      title: 'swal-borrado-title',
      htmlContainer: 'swal-borrado-html',
    },
  });
}
