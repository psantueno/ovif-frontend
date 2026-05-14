import { readExcelSecure, ExcelValidationError } from './secureExcelReader.util';
import { normalizarNumeroDecimal, normalizarNumeroEntero } from './normalizadorNumerico';

const EXPECTED_HEADERS = [
  'cod_recurso',
  'descripcion',
  'cod_fuente_financiera',
  'descripcion_fuente',
  'vigente',
  'percibido',
] as const;

export interface RecursoPreviewRow {
  filaExcel: number;
  cod_recurso: number | null;
  descripcion: string;
  cod_fuente_financiera: number | null;
  descripcion_fuente: string;
  vigente: number | null;
  percibido: number | null;
  errores: string[];
  tieneError: boolean;
}

export interface RecursosExcelParseResult {
  rows: RecursoPreviewRow[];
  totalRowsRead: number;
  validRows: number;
  invalidRows: number;
  globalErrors: string[];
}

const normalizeHeader = (value: unknown): string => {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
};

const isRowEmpty = (row: unknown[]): boolean => {
  return row.every((cell) => String(cell ?? '').trim() === '');
};

const toCellString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
};

export const parseRecursosExcelFile = async (file: File): Promise<RecursosExcelParseResult> => {
  const globalErrors: string[] = [];

  let matrix: unknown[][];
  try {
    matrix = await readExcelSecure(file);
  } catch (error) {
    if (error instanceof ExcelValidationError) {
      globalErrors.push(error.message);
    } else {
      globalErrors.push('Ocurrió un error inesperado al procesar el archivo.');
    }
    return {
      rows: [],
      totalRowsRead: 0,
      validRows: 0,
      invalidRows: 0,
      globalErrors,
    };
  }

  if (!matrix.length) {
    globalErrors.push('El archivo está vacío.');
    return {
      rows: [],
      totalRowsRead: 0,
      validRows: 0,
      invalidRows: 0,
      globalErrors,
    };
  }

  const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  const headerRowFiltered = headerRow.filter(row => row !== null && row !== undefined && row !== "")
  const normalizedHeaders = headerRowFiltered
    .map((header) => normalizeHeader(header))
    .filter((header) => header.length > 0);

  const headersValid =
    normalizedHeaders.length === EXPECTED_HEADERS.length &&
    EXPECTED_HEADERS.every((header, index) => normalizedHeaders[index] === header);

  if (!headersValid) {
    globalErrors.push(
      `La fila 1 debe contener exactamente estos encabezados y en este orden: ${EXPECTED_HEADERS.join(', ')}.`
    );

    if (normalizedHeaders.length > 0) {
      globalErrors.push(`Encabezados detectados: ${normalizedHeaders.join(', ')}.`);
    }

    return {
      rows: [],
      totalRowsRead: 0,
      validRows: 0,
      invalidRows: 0,
      globalErrors,
    };
  }

  const rows: RecursoPreviewRow[] = [];

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
    if (isRowEmpty(row)) {
      continue;
    }

    const filaExcel = rowIndex + 1;
    const errores: string[] = [];

    const codRecursoRaw = toCellString(row[0]);
    const descripcion = toCellString(row[1]);
    const codFuenteRaw = toCellString(row[2]);
    const descripcionFuente = toCellString(row[3]);
    const vigenteRaw = toCellString(row[4]);
    const percibidoRaw = toCellString(row[5]);

    const codRecurso = normalizarNumeroEntero(codRecursoRaw, 'cod_recurso', errores);

    if (!descripcion) {
      errores.push('El campo descripcion es obligatorio.');
    }

    const codFuenteFinanciera = normalizarNumeroEntero(codFuenteRaw, 'cod_fuente_financiera', errores);

    if (!descripcionFuente) {
      errores.push('El campo descripcion_fuente es obligatorio.');
    }

    const vigente = normalizarNumeroDecimal(vigenteRaw, 'vigente', errores);
    const percibido = normalizarNumeroDecimal(percibidoRaw, 'percibido', errores);

    rows.push({
      filaExcel,
      cod_recurso: codRecurso,
      descripcion,
      cod_fuente_financiera: codFuenteFinanciera,
      descripcion_fuente: descripcionFuente,
      vigente,
      percibido,
      errores,
      tieneError: errores.length > 0,
    });
  }

  // Deteccion de duplicados por cod_recurso, alineada con la clave real del backend.
  const duplicates = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (row.cod_recurso === null) {
      return;
    }

    const key = String(row.cod_recurso);
    const positions = duplicates.get(key) ?? [];
    positions.push(index);
    duplicates.set(key, positions);
  });

  duplicates.forEach((indexes) => {
    if (indexes.length <= 1) {
      return;
    }

    indexes.forEach((index) => {
      const codigo = rows[index].cod_recurso;
      rows[index].errores.push(
        `El cod_recurso ${codigo} está duplicado en el archivo.`
      );
      rows[index].tieneError = true;
    });
  });

  const totalRowsRead = rows.length;
  const invalidRows = rows.filter((row) => row.tieneError).length;
  const validRows = totalRowsRead - invalidRows;

  if (totalRowsRead === 0) {
    globalErrors.push('No se encontraron filas de datos a partir de la fila 2.');
  }

  return {
    rows,
    totalRowsRead,
    validRows,
    invalidRows,
    globalErrors,
  };
};
