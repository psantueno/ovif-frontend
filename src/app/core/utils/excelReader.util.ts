import { readExcelSecure } from './secureExcelReader.util';

export interface Remuneraciones {
  legajo: number,
  cuil: string,
  apellido_nombre: string,
  regimen_laboral: string,
  categoria: string,
  sector: string,
  fecha_ingreso: string,
  fecha_inicio_servicio: string,
  fecha_fin_servicio: string | null,
  basico_cargo_salarial: number,
  total_remunerativo: number,
  sac: number,
  cant_hs_extras_50: number,
  importe_horas_extras_50: number,
  cant_hs_extras_100: number,
  importe_horas_extras_100: number,
  total_no_remunerativo: number,
  total_ropa: number,
  total_bonos: number,
  asignaciones_familiares: number,
  total_descuentos: number,
  total_issn: number,
  art: number,
  seguro_vida_obligatorio: number,
  neto_a_cobrar: number
}

export interface Recaudaciones {
  codigo_tributo: string,
  descripcion: string,
  importe_recaudacion: string,
  ente_recaudador: string
}

export interface RecaudacionesParseados {
  codigo_tributo: number,
  descripcion: string,
  importe_recaudacion: number,
  ente_recaudador: string
}

interface ExcelParser<T> {
  rows: T[],
  file: File | null
}

export interface ExcelRowWithMetadata<T> {
  row: T;
  filaExcel: number;
}

interface ExcelParserWithMetadata<T> {
  rows: ExcelRowWithMetadata<T>[],
  file: File | null
}

export const onFileChange = <T>(event: any): Promise<ExcelParser<T>> => {
  const file = event.target.files?.[0] ?? null;

  if (!file) {
    return Promise.resolve({
      rows: [],
      file: null
    });
  }

  return (async () => {
    const rows = await readExcelSecure(file, { raw: true });
    const jsonRows = transformRowsToJson<T>(rows as any[][]);
    return { rows: jsonRows, file };
  })();
};

export const onFileChangeWithMetadata = <T>(event: any): Promise<ExcelParserWithMetadata<T>> => {
  const file = event.target.files?.[0] ?? null;

  if (!file) {
    return Promise.resolve({
      rows: [],
      file: null
    });
  }

  return (async () => {
    const rows = await readExcelSecure(file, { raw: true });
    const rowsWithMetadata = transformRowsToJsonWithMetadata<T>(rows as any[][]);
    return { rows: rowsWithMetadata, file };
  })();
};

const normalizeHeader = (header: string) => {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, ""); // quita %, $, etc.
}

const transformRowsToJson = <T>(rows: any[][]): T[] => {
  if (!rows.length) return [];

  // 🔎 encontrar índice del header real
  const headerIndex = rows.findIndex(row =>
    row.every(cell => cell !== null && cell !== undefined && cell !== "")
  );

  if (headerIndex === -1) return [];

  // ✅ headers dinámicos
  const headers = rows[headerIndex].map(h =>
    normalizeHeader(String(h))
  );

   // ✅ datos empiezan después del header
  const dataRows = rows.slice(headerIndex + 1);

  // construir objetos dinámicamente
  const objects = dataRows.map(row => {
    const obj: any = {};

    headers.forEach((header, index) => {
      const value = row[index];
      obj[header] = (value === undefined || value === null || value === '') ? null : value;
    });

    return obj;
  });

  // 🔎 eliminar objetos que tengan algún valor null
  return objects.filter(obj =>
    Object.values(obj).every(value => value !== null)
  );
}

const isCellEmpty = (value: any): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  return false;
}

const transformRowsToJsonWithMetadata = <T>(rows: any[][]): ExcelRowWithMetadata<T>[] => {
  if (!rows.length) return [];

  const headerIndex = rows.findIndex(row => row[1] !== null && row[1] !== undefined && row[1] !== "");

  if (headerIndex === -1) return [];

  const headerRow = rows[headerIndex];
  const headerRowFiltered = headerRow.filter(row => row !== null)

  const headers = headerRowFiltered.map(h =>
    normalizeHeader(String(h))
  );

  const dataRows = rows.slice(headerIndex + 1);

  return dataRows.reduce<ExcelRowWithMetadata<T>[]>((acc, row, index) => {
    if (!row || row.every((cell) => isCellEmpty(cell))) {
      return acc;
    }

    const obj: any = {};
    headers.forEach((header, colIndex) => {
      const value = row[colIndex];
      obj[header] = (value === undefined || value === null || value === '') ? null : value;
    });

    if(Object.values(obj).every(value => value !== null)){
      acc.push({
        row: obj as T,
        filaExcel: headerIndex + index + 2
      });
    }

    return acc;
  }, []);
}
