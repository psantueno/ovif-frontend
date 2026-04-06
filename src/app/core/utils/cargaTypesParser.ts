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
