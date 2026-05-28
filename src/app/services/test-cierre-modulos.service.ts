import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../app.config';

export type ModuloCierre = 'GASTOS' | 'RECURSOS' | 'RECAUDACIONES' | 'REMUNERACIONES' | 'DETERMINACION_TRIBUTARIA';

export interface TestCierreModulosRequest {
  ejercicio: number;
  mes: number;
  municipio_id: number;
  modulos: ModuloCierre[];
  enviar_mail: boolean;
}

export interface CierreModuloDetalle {
  ejercicio: number;
  mes: number;
  municipio_id: number;
  convenio_id: number;
  convenio_nombre: string;
  pauta_id: number;
  modulo: string;
  tipo_cierre: string;
  observacion: string;
  id_documento: string;
  cierre_existente: boolean;
}

export interface CronLogDetalle {
  nombre_tarea: string;
  estado: string;
  mensaje: string;
}

export interface SimulacionItem {
  cierre_modulo: CierreModuloDetalle;
  cron_log: CronLogDetalle;
}

export interface EnvioCorreoItem {
  grupo_modulos: string[];
  destinatario: string;
  nombre_destinatario: string;
  asunto: string;
  payload: Record<string, unknown>;
}

export interface MailTestGrupo {
  modulos: string[];
  html: string;
  id_envio_correo: number | null;
  enviado: boolean | null;
  error: string | null;
}

export interface ResumenEnvio {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
}

export interface MailTest {
  destinatario_test: string | null;
  grupos: MailTestGrupo[];
  resumen_envio?: ResumenEnvio;
  error?: string;
}

export interface TestCierreModulosResponse {
  municipio: { municipio_id: number; municipio_nombre: string };
  simulacion: SimulacionItem[];
  envio_correos: EnvioCorreoItem[];
  mail_test: MailTest;
}

@Injectable({ providedIn: 'root' })
export class TestCierreModulosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  simularCierreModulos(payload: TestCierreModulosRequest): Observable<TestCierreModulosResponse> {
    return this.http.post<TestCierreModulosResponse>(`${this.apiUrl}/tests/cierre-modulos`, payload);
  }
}
