import * as XLSX from 'xlsx';

export interface ExcelSecurityOptions {
  maxBytes?: number;
  maxRows?: number;
  maxColumns?: number;
  timeoutMs?: number;
  /** If true, numbers/booleans are returned as native types. If false (default), all values are strings. */
  raw?: boolean;
}

export const EXCEL_LIMITS: Required<Omit<ExcelSecurityOptions, 'raw'>> = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 25000,
  maxColumns: 100,
  timeoutMs: 10000,
};

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];

const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  '',
];

export class ExcelValidationError extends Error {
  constructor(
    message: string,
    public readonly code: ExcelErrorCode,
  ) {
    super(message);
    this.name = 'ExcelValidationError';
  }
}

export type ExcelErrorCode =
  | 'INVALID_EXTENSION'
  | 'INVALID_MIME'
  | 'FILE_TOO_LARGE'
  | 'FILE_EMPTY'
  | 'TOO_MANY_ROWS'
  | 'TOO_MANY_COLUMNS'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'NO_SHEETS';

export function validateExcelFile(file: File, options?: ExcelSecurityOptions): void {
  const limits = { ...EXCEL_LIMITS, ...options };

  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new ExcelValidationError(
      `Extensión "${extension}" no permitida. Solo se aceptan archivos .xlsx o .xls.`,
      'INVALID_EXTENSION',
    );
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ExcelValidationError(
      'El archivo no tiene un formato Excel válido.',
      'INVALID_MIME',
    );
  }

  if (file.size === 0) {
    throw new ExcelValidationError(
      'El archivo está vacío.',
      'FILE_EMPTY',
    );
  }

  if (file.size > limits.maxBytes) {
    const maxMB = (limits.maxBytes / (1024 * 1024)).toFixed(0);
    throw new ExcelValidationError(
      `El archivo supera el tamaño máximo permitido (${maxMB} MB).`,
      'FILE_TOO_LARGE',
    );
  }
}

export async function readExcelSecure(
  file: File,
  options?: ExcelSecurityOptions,
): Promise<unknown[][]> {
  const { raw, ...rest } = options ?? {};
  const limits = { ...EXCEL_LIMITS, ...rest };

  validateExcelFile(file, limits);

  const parsePromise = parseExcelFile(file, limits, raw ?? false);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new ExcelValidationError(
          'El procesamiento del archivo demoró demasiado. Intentá con un archivo más chico.',
          'TIMEOUT',
        ),
      );
    }, limits.timeoutMs);
  });

  return Promise.race([parsePromise, timeoutPromise]);
}

async function parseExcelFile(
  file: File,
  limits: Required<Omit<ExcelSecurityOptions, 'raw'>>,
  raw: boolean,
): Promise<unknown[][]> {
  const buffer = await file.arrayBuffer();

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'array',
      raw,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellNF: false,
      cellText: false,
      WTF: false,
    });
  } catch {
    throw new ExcelValidationError(
      'El archivo está corrupto o no es un archivo Excel válido.',
      'PARSE_ERROR',
    );
  }

  if (!workbook.SheetNames.length) {
    throw new ExcelValidationError(
      'El archivo no contiene hojas de cálculo.',
      'NO_SHEETS',
    );
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const ref = sheet['!ref'];
  if (!ref) {
    throw new ExcelValidationError(
      'El archivo está vacío.',
      'FILE_EMPTY',
    );
  }

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;

  if (rowCount > limits.maxRows) {
    throw new ExcelValidationError(
      `El archivo tiene demasiadas filas (${rowCount}). El máximo permitido es ${limits.maxRows}.`,
      'TOO_MANY_ROWS',
    );
  }

  if (colCount > limits.maxColumns) {
    throw new ExcelValidationError(
      `El archivo tiene demasiadas columnas (${colCount}). El máximo permitido es ${limits.maxColumns}.`,
      'TOO_MANY_COLUMNS',
    );
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: raw ? null : '',
    raw,
    blankrows: false,
  });

  return matrix;
}

export function getExcelProcessingErrorMessage(error: unknown): string {
  if (error instanceof ExcelValidationError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.message?.includes('File is password-protected')) {
      return 'El archivo está protegido con contraseña. Quitá la protección e intentá de nuevo.';
    }
    if (error.message?.includes('Unsupported file')) {
      return 'El formato del archivo no es compatible. Usá un archivo .xlsx o .xls.';
    }
  }

  return 'Ocurrió un error inesperado al procesar el archivo. Verificá que sea un Excel válido.';
}
