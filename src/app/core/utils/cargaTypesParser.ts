import {
  ExcelRowWithMetadata,
  Gastos,
  GastosParseados,
  Recursos,
  RecursosParseados,
  Remuneraciones
} from "./excelReader.util"
import { GastosSchema, RecursosSchema, RemuneracionesSchema } from "./cargaValidator"
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

export const parseGastos = (rows: Gastos[]): ParseResponse<GastosParseados[], Gastos> => {
  const parsedGastos: GastosParseados[] = []
  const errors: ParseError<Gastos>[] = []

  rows.forEach((row) => {
    const result = GastosSchema.safeParse(row);

    if(result.success){
      const gastoValido: GastosParseados = {
        codigo_partida: result.data.codigo_partida,
        importe_devengado: result.data.importe_devengado,
        descripcion: row.descripcion
      }

      parsedGastos.push(gastoValido)
    } else {
        const error: ParseError<Gastos> = {
          row: row,
          error: obtenerMensajeError(result.error)
        }
        errors.push(error)
    }
  })

  const parseResponse: ParseResponse<GastosParseados[], Gastos> = {
    rows: parsedGastos,
    errors: errors
  }

  return parseResponse
}

export const parseRecursos = (rows: Recursos[]): ParseResponse<RecursosParseados[], Recursos> => {
  const parsedRecursos: RecursosParseados[] = []
  const errors: ParseError<Recursos>[] = []

  rows.forEach((row) => {
    const result = RecursosSchema.safeParse(row);

    if(result.success){
      const recursoValido: RecursosParseados = {
        codigo_partida: result.data.codigo_partida,
        importe: result.data.importe,
        descripcion: row.descripcion
      }

      parsedRecursos.push(recursoValido)
    } else {
        const error: ParseError<Recursos> = {
          row: row,
          error: obtenerMensajeError(result.error)
        }
        errors.push(error)
    }
  })

  const parseResponse: ParseResponse<RecursosParseados[], Recursos> = {
    rows: parsedRecursos,
    errors: errors
  }

  return parseResponse
}

export const parseRemuneraciones = (rows: Remuneraciones[]): ParseResponse<Remuneraciones[], Remuneraciones> => {
  const parsedRemuneraciones: Remuneraciones[] = []
  const errors: ParseError<Remuneraciones>[] = []

  rows.forEach((row) => {
    const result = RemuneracionesSchema.safeParse(row);

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

  rows.forEach(({ row, filaExcel }) => {
    const result = RemuneracionesSchema.safeParse(row);

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
