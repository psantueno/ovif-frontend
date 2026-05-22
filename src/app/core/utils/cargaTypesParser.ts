import {
  ExcelRowWithMetadata,
  Remuneraciones
} from "./excelReader.util"
import { RemuneracionesSchema } from "./cargaValidator"
import { ZodError } from "zod"

export interface ParseError<T> {
  row: T,
  error: string,
  filaExcel?: number
}

export interface ParseResponse<T, N>{
  rows: T
  errors: ParseError<N>[]
}

const obtenerMensajeError = (error: ZodError): string => {
  let errorMessage = ''
  error.issues.forEach((i) => {
    errorMessage += `${i.message}. `
  })

  return errorMessage
}

// Mapea aliases de headers del Excel a las keys canónicas del schema.
// Permite que el Excel use tanto "IMPORTE_HS_EXTRAS_50" como "IMPORTE_HORAS_EXTRAS_50".
const REMUNERACIONES_HEADER_ALIASES: Record<string, string> = {
  importe_hs_extras_50: 'importe_horas_extras_50',
  importe_hs_extras_100: 'importe_horas_extras_100',
};

const normalizarKeysRemuneracion = (row: Record<string, any>): Record<string, any> => {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[REMUNERACIONES_HEADER_ALIASES[key] ?? key] = value;
  }
  return normalized;
};

/**
 * Normaliza un CUIL para comparación: elimina guiones, puntos y espacios,
 * dejando solo dígitos. Esto asegura que "23-38155293-4" y 23381552934
 * (numérico desde Excel) se traten como iguales.
 */
const normalizarCuil = (cuil: unknown): string =>
  String(cuil ?? '').replace(/[\s.\-]/g, '').trim();

const validarClaveUnicaPorCuilRegimen = (
  row: Remuneraciones,
  clavesPorCuilRegimen: Set<string>,
  errors: ParseError<Remuneraciones>[],
  filaExcel?: number
): boolean => {
  const cuil = normalizarCuil(row.cuil);
  const regimen = String(row.regimen_laboral ?? '').trim();

  if (!cuil || !regimen) return true; // sin datos suficientes, deja que Zod lo rechace

  const key = `${cuil}::${regimen.toLocaleLowerCase()}`;

  if (clavesPorCuilRegimen.has(key)) {
    errors.push({
      row,
      error: `La combinación CUIL ${String(row.cuil).trim()} y régimen ${regimen} está duplicada en el archivo.`,
      filaExcel
    });
    return false;
  }

  clavesPorCuilRegimen.add(key);
  return true;
};

export const parseRemuneraciones = (rows: Remuneraciones[]): ParseResponse<Remuneraciones[], Remuneraciones> => {
  const parsedRemuneraciones: Remuneraciones[] = []
  const errors: ParseError<Remuneraciones>[] = []
  const clavesPorCuilRegimen = new Set<string>()

  rows.forEach((row) => {
    if (!validarClaveUnicaPorCuilRegimen(row, clavesPorCuilRegimen, errors)) {
      return
    }

    const result = RemuneracionesSchema.safeParse(normalizarKeysRemuneracion(row));

    if(result.success){
      const remuneracionValida: Remuneraciones = {...result.data}
      parsedRemuneraciones.push(remuneracionValida)
    } else {
        const error: ParseError<Remuneraciones> = {
          row: row,
          error: obtenerMensajeError(result.error)
        }
        errors.push(error)
    }
  })

  const parseResponse: ParseResponse<Remuneraciones[], Remuneraciones> = {
    rows: parsedRemuneraciones,
    errors: errors
  }

  return parseResponse
}

export const parseRemuneracionesConMetadata = (
  rows: ExcelRowWithMetadata<Remuneraciones>[]
): ParseResponse<Remuneraciones[], Remuneraciones> => {
  const parsedRemuneraciones: Remuneraciones[] = []
  const errors: ParseError<Remuneraciones>[] = []
  const clavesPorCuilRegimen = new Set<string>()

  rows.forEach(({ row, filaExcel }) => {
    if (!validarClaveUnicaPorCuilRegimen(row, clavesPorCuilRegimen, errors, filaExcel)) {
      return
    }

    const result = RemuneracionesSchema.safeParse(normalizarKeysRemuneracion(row));

    if(result.success){
      const remuneracionValida: Remuneraciones = { ...result.data }
      parsedRemuneraciones.push(remuneracionValida)
    } else {
      const error: ParseError<Remuneraciones> = {
        row: row,
        error: obtenerMensajeError(result.error),
        filaExcel
      }
      errors.push(error)
    }
  })

  const parseResponse: ParseResponse<Remuneraciones[], Remuneraciones> = {
    rows: parsedRemuneraciones,
    errors: errors
  }

  return parseResponse
}
