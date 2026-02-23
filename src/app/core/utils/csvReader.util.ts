import * as Papa from 'papaparse';

type ValidationRule = { required?: boolean; type?: 'number' | 'decimal' | 'select', step?: number, options?: string[]; };
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

const reglasValidacionRecaudaciones: ValidationRules = {
  'cod_concepto': { required: true, type: 'number' },
  'concepto': { required: true },
  'importe_recaudacion': { required: true, type: 'decimal', step: 2 },
}

const reglasValidacionRemuneraciones: ValidationRules = {
  'regimen': { required: true, options: ['PLANTA POLITICA', 'PLANTA PERMANENTE', 'PLANTA TEMPORARIA', 'MONOTRIBUTISTA', 'CONTRAPRESTA PERCIBIENDO RETRIBUCION POR SUBSIDIO', 'PRESTA SERVICIO Y PERCIBE REUMNERACION', 'PERCIBE SUBSIDIO'] },
  'cuil': { required: true, type: 'number' },
  'apellido_nombre': { required: true },
  'legajo' : { type: 'number', required: true },
  'situacion_revista': { required: true },
  'fecha_alta': { required: true },
  'remuneracion_neta': { required: true, type: 'decimal', step: 2 },
  'tipo_liquidacion': { required: true, type: 'select', options: ['SUELDO', '1° SAC', '2° SAC'] },
  'bonificacion': { type: 'decimal', step: 2 },
  'cant_hs_extra_50': { type: 'number' },
  'cant_hs_extra_100': { type: 'number' },
  'importe_hs_extra_50': { type: 'decimal', step: 2 },
  'importe_hs_extra_100': { type: 'decimal', step: 2 },
  'art': { type: 'decimal', step: 2 },
  'seguro_vida': { type: 'decimal', step: 2 },
  'otros_conceptos': { type: 'decimal', step: 2 },
}

const RULES = {
  'gastos': reglasValidacionGastos,
  'recursos': reglasValidacionRecursos,
  'recaudaciones': reglasValidacionRecaudaciones,
  'remuneraciones': reglasValidacionRemuneraciones,
}

type Context = 'gastos' | 'recursos' | 'recaudaciones' | 'remuneraciones';

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

type RecaudacionesRow = {
  cod_concepto: number;
  concepto: string;
  importe_recaudacion: number;
}

type RemuneracionesRow = {
  regimen: string;
  cuil: number;
  apellido_nombre: string;
  situacion_revista: string;
  fecha_alta: string;
  remuneracion_neta: number;
  tipo_liquidacion: string;
  bonificacion?: number;
  cant_hs_extra_50?: number;
  cant_hs_extra_100?: number;
  importe_hs_extra_50?: number;
  importe_hs_extra_100?: number;
  art?: number;
  seguro_vida?: number;
  otros_conceptos?: number;
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

                const mappedRows = rows.map((row) => {
                  let mappedImporteDevengado = convertirCadenasANumeros(row.importe_devengado);

                  return {
                    ...row,
                    importe_devengado: mappedImporteDevengado
                  }
                });

                const filteredRows = mappedRows.filter(row => Object.keys(row || {}).length > 0 && row.importe_devengado !== undefined && row.importe_devengado !== null && row.importe_devengado !== 0);

                resolve({rows: filteredRows, errores: validarFilas(filteredRows, context)});
                return;
              }
              if(context === 'recursos') {
                const rows = (results.data ?? []) as RecursosRow[];

                const mappedRows = rows.map((row) =>{
                  let mappedImportePercibido = convertirCadenasANumeros(row.importe_percibido);

                  return{
                    ...row,
                    importe_percibido: mappedImportePercibido
                  }
                });

                const filteredRows = mappedRows.filter(row => Object.keys(row || {}).length > 0 && row.importe_percibido !== undefined && row.importe_percibido !== null && row.importe_percibido !== 0);

                resolve({rows: filteredRows, errores: validarFilas(filteredRows, context)});
                return;
              }
              if(context === 'recaudaciones') {
                const rows = (results.data ?? []) as RecaudacionesRow[];

                const mappedRows = rows.map((row) => {
                  let mappedImporteRecaudacion: number = convertirCadenasANumeros(row.importe_recaudacion);

                  return {
                    ...row,
                    importe_recaudacion: mappedImporteRecaudacion
                  }
                });

                const filteredRows = mappedRows.filter(row => Object.keys(row || {}).length > 0 && row.importe_recaudacion !== undefined && row.importe_recaudacion !== null);

                resolve({rows: filteredRows, errores: validarFilas(filteredRows, context)});
                return;
              }
              if(context === 'remuneraciones') {
                const rows = (results.data ?? []) as RemuneracionesRow[];

                const mappedRows = rows.map((row) => {
                  let mappedApellidoNombre: string = convertirNumerosACadena(row.apellido_nombre);
                  let mappedRemuneracionNeta: number = convertirCadenasANumeros(row.remuneracion_neta);
                  let mappedSituacionRevista: string = convertirNumerosACadena(row.situacion_revista);
                  let mappedTipoLiquidacion: string = convertirNumerosACadena(row.tipo_liquidacion)
                  let mappedBonificacion: number = convertirCadenasANumeros(row.bonificacion);
                  let mappedImporteHsExtra50: number = convertirCadenasANumeros(row.importe_hs_extra_50);
                  let mappedImporteHsExtra100: number = convertirCadenasANumeros(row.importe_hs_extra_100);
                  let mappedArt: number = convertirCadenasANumeros(row.art);
                  let mappedSeguroVida: number = convertirCadenasANumeros(row.seguro_vida);
                  let mappedOtrosConceptos: number = convertirCadenasANumeros(row.otros_conceptos);
                  let mappedFechaAlta: string = row.fecha_alta === '0/1/1900' ? '' : row.fecha_alta;

                  return {
                    ...row,
                    apellido_nombre: mappedApellidoNombre,
                    remuneracion_neta: mappedRemuneracionNeta,
                    situacion_revista: mappedSituacionRevista,
                    tipo_liquidacion: mappedTipoLiquidacion,
                    bonificacion: mappedBonificacion,
                    importe_hs_extra_50: mappedImporteHsExtra50,
                    importe_hs_extra_100: mappedImporteHsExtra100,
                    art: mappedArt,
                    seguro_vida: mappedSeguroVida,
                    otros_conceptos: mappedOtrosConceptos,
                    fecha_alta: mappedFechaAlta,
                  }
                })

                const filteredRows = mappedRows.filter(row => Object.keys(row || {}).length > 0 && row.cuil !== undefined && row.cuil !== null && row.cuil !== 0);

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
    'cod_concepto': 'Código de Concepto',
    'descripcion': 'Descripción',
    'importe_devengado': 'Importe Devengado',
    'importe_percibido': 'Importe Percibido',
    'importe_recaudacion': 'Importe Recaudación',
    'total_contribuyentes': 'Total Contribuyentes',
    'contribuyentes_pagaron': 'Contribuyentes que Pagaron',
    'regimen': 'Régimen',
    'cuil': 'CUIL',
    'apellido_nombre': 'Apellido y Nombre',
    'situacion_revista': 'Situación de Revista',
    'fecha_alta': 'Fecha de Alta',
    'remuneracion_neta': 'Remuneración Neta',
    'tipo_liquidacion': 'Tipo de Liquidación',
    'bonificacion': 'Bonificación',
    'cant_hs_extra_50': 'Cantidad de Horas Extra 50%',
    'cant_hs_extra_100': 'Cantidad de Horas Extra 100%',
    'importe_hs_extra_50': 'Importe Horas Extra 50%',
    'importe_hs_extra_100': 'Importe Horas Extra 100%',
    'art': 'ART',
    'seguro_vida': 'Seguro de Vida',
    'otros_conceptos': 'Otros Conceptos',
  };
  return campos[campo] || campo;
}

const validarFilas = (rows: any[], context: Context): any[] => {
    const reglasValidacion = RULES[context];
    const errores: any[] = [];

    const CODIGOS = {
      'gastos': 'codigo_partida',
      'recursos': 'codigo_partida',
      'recaudaciones': 'cod_concepto',
      'remuneraciones': 'cuil',
    }

    const codigo = CODIGOS[context];

    rows.forEach((row, index) => {
      for (const [campo, reglas] of Object.entries(reglasValidacion)) {
        const valor = row[campo];

        if (reglas.required && (valor === null || valor === undefined || valor === '')) {
          errores.push({ row: row[codigo], error: `El campo "${trasnformarCampo(campo)}" es obligatorio.` });
          continue;
        }

        if (reglas.type) {
          const tipoEsperado = reglas.type;
          const tipoValor = typeof valor;
          const valorNumerico = Number(valor);

          if(index === 0){
                      console.log("Campo: ", campo)
          console.log("Valor: ", valor)
          console.log("Tipo valor: ", tipoValor);
          console.log("Valor numerico: ", valorNumerico);
          }

          if (tipoEsperado === 'number' && tipoValor !== 'number' && isNaN(valorNumerico)) {
            errores.push({ row: row[codigo], error: `El campo "${trasnformarCampo(campo)}" debe ser un número.` });
            continue;
          }
          if (tipoEsperado === 'decimal' && tipoValor !== 'number' && isNaN(valorNumerico)) {
            errores.push({ row: row[codigo], error: `El campo "${trasnformarCampo(campo)}" debe ser un número decimal.` });
            continue;
          }
          if (tipoEsperado === 'decimal' && tipoValor === 'number' && reglas.step !== undefined) {
            const partes = valor.toString().split('.');
            const decimales = partes[1] ? partes[1].length : 0;
            if (decimales > reglas.step) {
              errores.push({ row: row[codigo], error: `El campo "${trasnformarCampo(campo)}" debe tener como máximo ${reglas.step} decimales.` });
              continue;
            }
          }
          if((tipoEsperado === 'number' || tipoEsperado === 'decimal') && tipoValor === 'number' && reglas.required && valor <= 0) {
            errores.push({ row: row[codigo], error: `El campo "${trasnformarCampo(campo)}" debe ser un número mayor que cero.` });
            continue;
          }
          if(tipoEsperado === 'select' && reglas.options && !reglas.options.includes(valor)) {
            errores.push({ row: row[codigo], error: `El campo "${trasnformarCampo(campo)}" tiene un valor inválido. Valores permitidos: ${reglas.options.join(', ')}.` });
            continue;
          }
        }
      }
    });

    return errores;
}

const convertirCadenasANumeros = (valor: any) => {
  let mappedValor = valor ?? 0;
  const tipoValor = typeof valor;

  if(tipoValor === 'string'){
    const valorStr = valor.toString();
    mappedValor = Number(valorStr.replace(',', '.')).toFixed(2);

    if(mappedValor === null || isNaN(mappedValor)) mappedValor = valor;
  }

  return mappedValor;
}

const convertirNumerosACadena = (valor: any) => {
  let mappedValor = valor;
  const tipoValor = typeof valor;

  if(tipoValor === 'number'){
    mappedValor = '';
  }

  return mappedValor;
}
