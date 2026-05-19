import { PeriodoSeleccionadoMunicipio } from '../../services/municipio.service';
import { BorradoContexto } from '../../models/borrado.model';
import { ModuloPauta } from '../../models/pauta.model';

const NOMBRES_MESES: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
};

export function nombreMes(mes: number): string {
  return NOMBRES_MESES[mes] ?? String(mes);
}

export function construirContextoBorrado(
  periodo: PeriodoSeleccionadoMunicipio,
  municipioNombre: string,
  modulo: ModuloPauta | string,
  tipoCarga: 'regular' | 'rectificacion'
): BorradoContexto {
  return {
    modulo,
    tipoCarga,
    municipioNombre,
    ejercicio: periodo.ejercicio,
    mes: periodo.mes,
    convenioNombre: periodo.convenio_nombre ?? null,
    pautaDescripcion: periodo.pauta_descripcion ?? null,
  };
}
