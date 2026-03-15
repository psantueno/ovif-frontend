import * as XLSX from 'xlsx';

export interface Gastos {
  codigo_partida: string,
  descripcion: string,
  importe_devengado: string
}

export interface GastosParseados {
  codigo_partida: number,
  descripcion: string,
  importe_devengado: number
}

export interface Recursos {
  codigo_partida: string,
  descripcion: string,
  importe: string
}

export interface RecursosParseados {
  codigo_partida: number,
  descripcion: string,
  importe: number
}

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
  cant_hs_extra_50: number,
  importe_hs_extra_50: number,
  cant_hs_extra_100: number,
  importe_hs_extra_100: number,
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

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const binary = e.target.result;

        const workbook = XLSX.read(binary, { type: 'binary' });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null
        });

        const jsonRows = transformRowsToJson<T>(rows);

        resolve({
          rows: jsonRows,
          file
        });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;

    reader.readAsBinaryString(file);
  });
};

export const onFileChangeWithMetadata = <T>(event: any): Promise<ExcelParserWithMetadata<T>> => {
  const file = event.target.files?.[0] ?? null;

  if (!file) {
    return Promise.resolve({
      rows: [],
      file: null
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const binary = e.target.result;

        const workbook = XLSX.read(binary, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null
        });

        const rowsWithMetadata = transformRowsToJsonWithMetadata<T>(rows);

        resolve({
          rows: rowsWithMetadata,
          file
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

const normalizeHeader = (header: string) => {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
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
      obj[header] = row[index] ?? null;
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

  const headerIndex = rows.findIndex(row =>
    row.every(cell => cell !== null && cell !== undefined && cell !== "")
  );

  if (headerIndex === -1) return [];

  const headers = rows[headerIndex].map(h =>
    normalizeHeader(String(h))
  );

  const dataRows = rows.slice(headerIndex + 1);

  return dataRows.reduce<ExcelRowWithMetadata<T>[]>((acc, row, index) => {
    if (!row || row.every((cell) => isCellEmpty(cell))) {
      return acc;
    }

    const obj: any = {};
    headers.forEach((header, colIndex) => {
      obj[header] = row[colIndex] ?? null;
    });

    acc.push({
      row: obj as T,
      filaExcel: headerIndex + index + 2
    });

    return acc;
  }, []);
}
