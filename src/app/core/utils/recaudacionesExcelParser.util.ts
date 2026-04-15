import * as XLSX from 'xlsx';
import { normalizarNumeroDecimal, normalizarNumeroEntero } from './normalizadorNumerico';

const EXPECTED_HEADERS = [
  'codigo_tributo',
  'descripcion',
  'importe_recaudacion',
  'ente_recaudador',
] as const;

export interface RecaudacionPreviewRow {
  filaExcel: number;
  codigo_tributo: number | null;
  descripcion: string;
  importe_recaudacion: number | null;
  ente_recaudador: string;
  errores: string[];
  tieneError: boolean;
}

export interface RecaudacionesExcelParseResult {
  rows: RecaudacionPreviewRow[];
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



export const parseRecaudacionesExcelFile = async (file: File): Promise<RecaudacionesExcelParseResult> => {
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

  const rows: RecaudacionPreviewRow[] = [];

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
    if (isRowEmpty(row)) {
      continue;
    }

    const filaExcel = rowIndex + 1;
    const errores: string[] = [];

    const codigoRaw = toCellString(row[0]);
    const descripcion = toCellString(row[1]);
    const importeRaw = toCellString(row[2]);
    const enteRecaudador = toCellString(row[3]);

    let codigoTributo: number | null = null;
    let importeRecaudacion: number | null = null;

    codigoTributo = normalizarNumeroEntero(codigoRaw, 'codigo_tributo', errores);

    if (!descripcion) {
      errores.push('El campo descripcion es obligatorio.');
    }

    importeRecaudacion = normalizarNumeroDecimal(importeRaw, 'importe_recaudacion', errores)

    if (!enteRecaudador) {
      errores.push('El campo ente_recaudador es obligatorio.');
    }

    rows.push({
      filaExcel,
      codigo_tributo: codigoTributo,
      descripcion,
      importe_recaudacion: importeRecaudacion,
      ente_recaudador: enteRecaudador,
      errores,
      tieneError: errores.length > 0,
    });
  }

  const duplicates = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (row.codigo_tributo === null || !row.ente_recaudador) {
      return;
    }

    const key = `${row.codigo_tributo}__${row.ente_recaudador.toLowerCase()}`;
    const positions = duplicates.get(key) ?? [];
    positions.push(index);
    duplicates.set(key, positions);
  });

  duplicates.forEach((indexes) => {
    if (indexes.length <= 1) {
      return;
    }

    indexes.forEach((index) => {
      const codigo = rows[index].codigo_tributo;
      const ente = rows[index].ente_recaudador;
      rows[index].errores.push(
        `La combinación codigo_tributo ${codigo} y ente_recaudador "${ente}" está duplicada en el archivo.`
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
