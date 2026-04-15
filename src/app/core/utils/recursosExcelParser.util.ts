import * as XLSX from 'xlsx';
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

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });

  if (!workbook.SheetNames.length) {
    globalErrors.push('El archivo no contiene hojas de cálculo.');
    return {
      rows: [],
      totalRowsRead: 0,
      validRows: 0,
      invalidRows: 0,
      globalErrors,
    };
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

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
  const normalizedHeaders = headerRow
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

  // Deteccion de duplicados por cod_recurso + cod_fuente_financiera
  const duplicates = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (row.cod_recurso === null || row.cod_fuente_financiera === null) {
      return;
    }

    const key = `${row.cod_recurso}__${row.cod_fuente_financiera}`;
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
      const fuente = rows[index].cod_fuente_financiera;
      rows[index].errores.push(
        `La combinación cod_recurso ${codigo} y cod_fuente_financiera ${fuente} está duplicada en el archivo.`
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
