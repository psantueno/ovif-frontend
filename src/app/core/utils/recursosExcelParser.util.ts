import * as XLSX from 'xlsx';

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

const normalizeSingleSeparator = (value: string, sep: string): string => {
  const escaped = sep === '.' ? '\\.' : sep;
  const occurrences = (value.match(new RegExp(escaped, 'g')) ?? []).length;

  if (occurrences > 1) {
    // Multiples ocurrencias: es separador de miles (ej: 1.234.567 o 1,234,567)
    return value.replace(new RegExp(escaped, 'g'), '');
  }

  // Una sola ocurrencia: verificar si es miles o decimal
  const afterSep = value.split(sep).pop() ?? '';
  if (/^\d{3}$/.test(afterSep)) {
    // Exactamente 3 digitos despues: es separador de miles (ej: 1.234 o 1,234)
    return value.replace(sep, '');
  }

  // 1 o 2 digitos despues: es separador decimal (ej: 1234,56 o 1234.5)
  return value.replace(sep, '.');
};

const parseImporte = (value: string): { value: number | null; decimalPlaces: number } => {
  let normalized = value.replace(/\s+/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    // Ambos separadores: el ultimo es decimal, el otro es miles
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalizeSingleSeparator(normalized, ',');
  } else if (normalized.includes('.')) {
    normalized = normalizeSingleSeparator(normalized, '.');
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

const parseCodigoEntero = (raw: string, campo: string, errores: string[]): number | null => {
  if (!raw) {
    errores.push(`El campo ${campo} es obligatorio.`);
    return null;
  }

  const result = parseImporte(raw);

  if (result.value === null || !Number.isInteger(result.value) || result.value <= 0) {
    errores.push(`El campo ${campo} debe ser un número entero mayor a 0.`);
    return null;
  }

  return result.value;
};

const parseDecimal = (raw: string, campo: string, errores: string[]): number | null => {
  if (!raw) {
    errores.push(`El campo ${campo} es obligatorio.`);
    return null;
  }

  const parsedImporte = parseImporte(raw);
  if (parsedImporte.value === null) {
    errores.push(`El campo ${campo} debe ser un número válido.`);
    return null;
  }

  if (parsedImporte.decimalPlaces > 2) {
    errores.push(`El campo ${campo} debe tener como máximo 2 decimales.`);
    return null;
  }

  return parsedImporte.value;
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

    const codRecurso = parseCodigoEntero(codRecursoRaw, 'cod_recurso', errores);

    if (!descripcion) {
      errores.push('El campo descripcion es obligatorio.');
    }

    const codFuenteFinanciera = parseCodigoEntero(codFuenteRaw, 'cod_fuente_financiera', errores);

    if (!descripcionFuente) {
      errores.push('El campo descripcion_fuente es obligatorio.');
    }

    const vigente = parseDecimal(vigenteRaw, 'vigente', errores);
    const percibido = parseDecimal(percibidoRaw, 'percibido', errores);

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
