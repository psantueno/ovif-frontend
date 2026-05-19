import { ModuloPauta } from './pauta.model';

export interface BorradoContexto {
  modulo: ModuloPauta | string;
  tipoCarga: 'regular' | 'rectificacion';
  municipioNombre: string;
  ejercicio: number;
  mes: number;
  convenioNombre: string | null;
  pautaDescripcion: string | null;
}

export interface BorradoResponse {
  code: 'DATA_DELETED' | 'NO_DATA_TO_DELETE' | 'USER_RATE_LIMITED' | 'MODULE_CLOSED';
  deleted_count: number;
  audit_id: number | null;
  message: string;
}
