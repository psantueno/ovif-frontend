import { z } from "zod";

const obtenerNumeroDecimal = (numero: string):number => {
  const valorNumerico = Number(numero.replace(',', '.'))
  return valorNumerico
}

const decimalSchema = z.preprocess((value) => {
  // si ya es número (Excel lo parseó)
  if (typeof value === "number") {
    return value;
  }

  // si es string → validar formato argentino
  if (typeof value === "string") {
    if (!/^\d+(,\d{1,2})?$/.test(value)) {
      return value; // deja que falle después
    }

    return obtenerNumeroDecimal(value);
  }

  return value;

},
z.number({ error: 'El importe debe ser un número decimal válido' }));

export const GastosSchema = z.object({
  codigo_partida: z
    .transform(v => Number(v))
    .pipe(
      z.number('El codigo de partida debe ser un número')
        .int('El código de partida debe ser un número entero')
        .min(0, 'El código de partida debe ser un número mayor a 0')
        .refine(n => isFinite(Number(n)) && !isNaN(n), 'El código de partida debe ser un número entero mayor a 0')
    ),

  descripcion: z
    .string()
    .min(1),

  importe_devengado: decimalSchema
});

export const RecursosSchema = z.object({
  codigo_partida: z
    .transform(v => Number(v))
    .pipe(
      z.number('El codigo de partida debe ser un número')
        .int('El código de partida debe ser un número entero')
        .min(0, 'El código de partida debe ser un número mayor a 0')
        .refine(n => isFinite(Number(n)) && !isNaN(n), 'El código de partida debe ser un número entero mayor a 0')
    ),

  descripcion: z
    .string()
    .min(1),

  importe: decimalSchema
});
