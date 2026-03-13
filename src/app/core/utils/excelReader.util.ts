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

export interface Recaudaciones {
  cod_concepto: string,
  importe_recaudacion: string,
  ente_recaudador: string
}

export interface RecaudacionesParseados {
  cod_concepto: number,
  importe_recaudacion: number,
  ente_recaudador: string
}

export interface Remuneraciones {

}

export interface RemuneracionesParseados {

}

interface ExcelParser<T> {
  rows: T[],
  file: File | null
}

export const onFileChange = <T>(event: any): Promise<ExcelParser<T>> => {
  const file = event.target.files[0];

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

  // 1️⃣ primera fila = headers
  const headers = rows[0].map(h => normalizeHeader(h));

  // 2️⃣ resto de filas = data
  const dataRows = rows.slice(1);

  // 3️⃣ construir objetos dinámicamente
  return dataRows.map(row => {
    const obj: any = {};

    headers.forEach((header, index) => {
      obj[header] = row[index] ?? null;
    });

    return obj;
  });
}
