import * as XLSX from 'xlsx';

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

const parseInteger = (raw: string): number | null => {
  const normalized = raw.replace(/\s+/g, '');
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
};

const parseDecimal = (raw: string): { value: number | null; decimalPlaces: number } => {
  let normalized = raw.replace(/\s+/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else {
    normalized = normalized.replace(',', '.');
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { value: null, decimalPlaces: 0 };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: null, decimalPlaces: 0 };
  }

  const decimalPart = normalized.split('.')[1] ?? '';
  return { value: parsed, decimalPlaces: decimalPart.length };
};

const pushIntegerValidation = (
  errores: string[],
  field: string,
  rawValue: string,
  options: { allowZero?: boolean } = {}
): number | null => {
  if (!rawValue) {
    errores.push(`El campo ${field} es obligatorio.`);
    return null;
  }

  const parsed = parseInteger(rawValue);
  if (parsed === null) {
    errores.push(`El campo ${field} debe ser un numero entero mayor o igual a 0.`);
    return null;
  }

  if (!options.allowZero && parsed === 0 && (field === 'anio' || field === 'cuota')) {
    errores.push(`El campo ${field} debe ser mayor a 0.`);
    return null;
  }

  return parsed;
};

const pushDecimalValidation = (errores: string[], field: string, rawValue: string): number | null => {
  if (!rawValue) {
    errores.push(`El campo ${field} es obligatorio.`);
    return null;
  }

  const parsed = parseDecimal(rawValue);
  if (parsed.value === null) {
    errores.push(`El campo ${field} debe ser un numero valido.`);
    return null;
  }

  if (parsed.value < 0) {
    errores.push(`El campo ${field} no puede ser negativo.`);
    return null;
  }

  if (parsed.decimalPlaces > 2) {
    errores.push(`El campo ${field} debe tener como maximo 2 decimales.`);
    return null;
  }

  const [integerPart] = rawValue.replace(/\s+/g, '').replace(',', '.').split('.');
  const integerDigits = integerPart.replace(/^[-+]?0+/, '').length || 1;
  if (integerDigits > 34) {
    errores.push(`El campo ${field} debe tener hasta 34 digitos enteros.`);
    return null;
  }

  return parsed.value;
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

    const codImpuesto = pushIntegerValidation(errores, 'cod_impuesto', toCellString(row[0]), {
      allowZero: true,
    });
    const descripcion = toCellString(row[1]);
    const anio = pushIntegerValidation(errores, 'anio', toCellString(row[2]));
    const cuota = pushIntegerValidation(errores, 'cuota', toCellString(row[3]));
    const liquidadas = pushIntegerValidation(errores, 'liquidadas', toCellString(row[4]), {
      allowZero: true,
    });
    const importeLiquidadas = pushDecimalValidation(errores, 'importe_liquidadas', toCellString(row[5]));
    const impagas = pushIntegerValidation(errores, 'impagas', toCellString(row[6]), {
      allowZero: true,
    });
    const importeImpagas = pushDecimalValidation(errores, 'importe_impagas', toCellString(row[7]));
    const pagadas = pushIntegerValidation(errores, 'pagadas', toCellString(row[8]), {
      allowZero: true,
    });
    const importePagadas = pushDecimalValidation(errores, 'importe_pagadas', toCellString(row[9]));
    const altasPeriodo = pushIntegerValidation(errores, 'altas_periodo', toCellString(row[10]), {
      allowZero: true,
    });
    const bajasPeriodo = pushIntegerValidation(errores, 'bajas_periodo', toCellString(row[11]), {
      allowZero: true,
    });

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
