import * as Papa from 'papaparse';

type ValidationRule = { required?: boolean; type?: 'number' | 'decimal', step?: number; };
type ValidationRules = Record<string, ValidationRule>;

const reglasValidacionGastos: ValidationRules = {
  'codigo_partida': { required: true, type: 'number' },
  'descripcion': { required: true },
  'importe_devengado': { required: true, type: 'decimal', step: 2 },
};

const reglasValidacionRecursos: ValidationRules = {
  'codigo_partida': { required: true, type: 'number' },
  'descripcion': { required: true },
  'importe_percibido': { required: true, type: 'decimal', step: 2 },
  'total_contribuyentes': { required: true, type: 'number' },
  'contribuyentes_pagaron': { required: true, type: 'number' },
}

type Context = 'gastos' | 'recursos';

type GastosRow = {
  codigo_partida: number;
  descripcion: string;
  importe_devengado: number;
}

type RecursosRow = {
  codigo_partida: number;
  descripcion: string;
  importe_percibido: number;
  total_contribuyentes: number;
  contribuyentes_pagaron: number;
}

export const parseCSV = (csvFile: File, context: Context = 'gastos'): Promise<{rows: any[], errores: any[]}> => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvFile, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true, // cast numeric-looking values to numbers
            complete: (results) => {
              if(context === 'gastos') {
                const rows = (results.data ?? []) as GastosRow[];

                const filteredRows = rows.filter(row => Object.keys(row || {}).length > 0 && row.importe_devengado !== undefined && row.importe_devengado !== null);

                resolve({rows: filteredRows, errores: validarFilas(filteredRows, context)});
                return;
              }
              if(context === 'recursos') {
                const rows = (results.data ?? []) as RecursosRow[];

                const filteredRows = rows.filter(row => Object.keys(row || {}).length > 0 && row.importe_percibido !== undefined && row.importe_percibido !== null);

                resolve({rows: filteredRows, errores: validarFilas(filteredRows, context)});
                return;
              }
            },
            error: (err) => {
                reject(err);
            }
        });
    });
}

const trasnformarCampo = (campo: string): string => {
  const campos: Record<string, string> = {
    'codigo_partida': 'Código de Partida',
    'descripcion': 'Descripción',
    'importe_devengado': 'Importe Devengado',
    'importe_percibido': 'Importe Percibido',
    'total_contribuyentes': 'Total Contribuyentes',
    'contribuyentes_pagaron': 'Contribuyentes que Pagaron',
  };
  return campos[campo] || campo;
}

const validarFilas = (rows: any[], context: Context): any[] => {
    const reglasValidacion = context === 'gastos' ? reglasValidacionGastos : reglasValidacionRecursos;
    const errores: any[] = [];

    rows.forEach((row, index) => {
      for (const [campo, reglas] of Object.entries(reglasValidacion)) {
        const valor = row[campo];

        if (reglas.required && (valor === null || valor === undefined || valor === '')) {
          errores.push({ row: row.codigo_partida, error: `El campo "${trasnformarCampo(campo)}" es obligatorio.` });
          continue;
        }

        if (reglas.type) {
          const tipoEsperado = reglas.type;
          const tipoValor = typeof valor;

          if (tipoEsperado === 'number' && tipoValor !== 'number') {
            errores.push({ row: row.codigo_partida, error: `El campo "${trasnformarCampo(campo)}" debe ser un número.` });
            continue;
          }
          if (tipoEsperado === 'decimal' && tipoValor !== 'number') {
            errores.push({ row: row.codigo_partida, error: `El campo "${trasnformarCampo(campo)}" debe ser un número decimal.` });
            continue;
          }
          if (tipoEsperado === 'decimal' && tipoValor === 'number' && reglas.step !== undefined) {
            const partes = valor.toString().split('.');
            const decimales = partes[1] ? partes[1].length : 0;
            if (decimales > reglas.step) {
              errores.push({ row: row.codigo_partida, error: `El campo "${trasnformarCampo(campo)}" debe tener como máximo ${reglas.step} decimales.` });
              continue;
            }
          }
          if((tipoEsperado === 'number' || tipoEsperado === 'decimal') && tipoValor === 'number' && valor <= 0) {
            errores.push({ row: row.codigo_partida, error: `El campo "${trasnformarCampo(campo)}" debe ser un número mayor que cero.` });
            continue;
          }
        }
      }
    });

    return errores;
}
