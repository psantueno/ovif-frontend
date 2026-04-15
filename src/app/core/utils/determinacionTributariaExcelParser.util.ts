import * as XLSX from 'xlsx';
import { normalizarNumeroEntero, normalizarNumeroDecimal } from './normalizadorNumerico';

const EXPECTED_HEADERS = [
  'cod_impuesto',
  'descripcion',
  'anio',
  'cuota',
  'liquidadas',
  'importe_liquidadas',
  'impagas',
  'importe_impagas',
  'pagadas',
  'importe_pagadas',
  'altas_periodo',
  'bajas_periodo',
] as const;

export interface DeterminacionTributariaPreviewRow {
  filaExcel: number;
  cod_impuesto: number | null;
  descripcion: string;
  anio: number | null;
  cuota: number | null;
  liquidadas: number | null;
  importe_liquidadas: number | null;
  impagas: number | null;
  importe_impagas: number | null;
  pagadas: number | null;
  importe_pagadas: number | null;
  altas_periodo: number | null;
  bajas_periodo: number | null;
  errores: string[];
  tieneError: boolean;
}

export interface DeterminacionTributariaExcelParseResult {
  rows: DeterminacionTributariaPreviewRow[];
  totalRowsRead: number;
  validRows: number;
  invalidRows: number;
  globalErrors: string[];
}

const normalizeHeader = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const isRowEmpty = (row: unknown[]): boolean =>
  row.every((cell) => String(cell ?? '').trim() === '');

const toCellString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

export const parseDeterminacionTributariaExcelFile = async (
  file: File
): Promise<DeterminacionTributariaExcelParseResult> => {
  const globalErrors: string[] = [];

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });

  if (!workbook.SheetNames.length) {
    globalErrors.push('El archivo no contiene hojas de calculo.');
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
    globalErrors.push('El archivo esta vacio.');
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

  const rows: DeterminacionTributariaPreviewRow[] = [];

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
    if (isRowEmpty(row)) {
      continue;
    }

    const filaExcel = rowIndex + 1;
    const errores: string[] = [];

    const codImpuesto = normalizarNumeroEntero(toCellString(row[0]), 'cod_impuesto', errores, true);
    const descripcion = toCellString(row[1]);
    const anio = normalizarNumeroEntero(toCellString(row[2]), 'anio', errores);
    const cuota = normalizarNumeroEntero(toCellString(row[3]), 'cuota', errores);
    const liquidadas = normalizarNumeroEntero(toCellString(row[4]), 'liquidadas', errores, true);
    const importeLiquidadas = normalizarNumeroDecimal(toCellString(row[5]), 'importe_liquidadas', errores);
    const impagas = normalizarNumeroEntero(toCellString(row[6]), 'impagas', errores, true);
    const importeImpagas = normalizarNumeroDecimal(toCellString(row[7]), 'importe_impagas', errores);
    const pagadas = normalizarNumeroEntero(toCellString(row[8]), 'pagadas', errores, true);
    const importePagadas = normalizarNumeroDecimal(toCellString(row[9]), 'importe_pagadas', errores);
    const altasPeriodo = normalizarNumeroEntero(toCellString(row[10]), 'altas_periodo', errores, true);
    const bajasPeriodo = normalizarNumeroEntero(toCellString(row[11]), 'bajas_periodo', errores, true);

    if (!descripcion) {
      errores.push('El campo descripcion es obligatorio.');
    } else if (descripcion.length > 255) {
      errores.push('El campo descripcion no puede superar los 255 caracteres.');
    }

    rows.push({
      filaExcel,
      cod_impuesto: codImpuesto,
      descripcion,
      anio,
      cuota,
      liquidadas,
      importe_liquidadas: importeLiquidadas,
      impagas,
      importe_impagas: importeImpagas,
      pagadas,
      importe_pagadas: importePagadas,
      altas_periodo: altasPeriodo,
      bajas_periodo: bajasPeriodo,
      errores,
      tieneError: errores.length > 0,
    });
  }

  const duplicates = new Map<number, number[]>();
  rows.forEach((row, index) => {
    if (row.cod_impuesto === null) {
      return;
    }

    const positions = duplicates.get(row.cod_impuesto) ?? [];
    positions.push(index);
    duplicates.set(row.cod_impuesto, positions);
  });

  duplicates.forEach((indexes, codImpuesto) => {
    if (indexes.length <= 1) {
      return;
    }

    indexes.forEach((index) => {
      rows[index].errores.push(
        `El cod_impuesto ${codImpuesto} esta duplicado en el archivo.`
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
