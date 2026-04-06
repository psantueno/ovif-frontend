import { z } from "zod";

const obtenerNumeroDecimal = (numero: string):number => {
  const valorNumerico = Number(numero.replace(',', '.'))
  return valorNumerico
}

const parseExcelDate = (fecha: string): string => {
  const [dia, mes, anio] = fecha.split("/");
  return `${anio}-${mes}-${dia}`;
};

const decimalSchema = (campo: string = "importe") =>
  z.preprocess((value) => {

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      if (!/^\d+(,\d{1,2})?$/.test(value)) {
        return value;
      }

      return obtenerNumeroDecimal(value);
    }

    return value;

  },
  z.number({
    error: `El campo "${campo}" debe ser un número decimal válido`
  }));

const fechaSchema = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Formato de fecha inválido (dd/mm/yyyy)")
  .transform(parseExcelDate);

  const fechaFinServicioSchema = z
    .string('La fecha de fin del servicio debe ser una cadena de caracteres')
    .transform((value, ctx) => {
      // caso "-"
      if (value === "-") {
        return null;
      }

      // validar formato dd/mm/yyyy
      const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

      if (!match) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato de fecha inválido (dd/mm/yyyy)"
        });
        return z.NEVER;
      }

      const [, d, m, y] = match;

      const date = new Date(Number(y), Number(m) - 1, Number(d));

      // validar fecha real
      if (
        date.getFullYear() !== Number(y) ||
        date.getMonth() !== Number(m) - 1 ||
        date.getDate() !== Number(d)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fecha inválida"
        });
        return z.NEVER;
      }

      // retornar yyyy-mm-dd
      return `${y}-${m}-${d}`;
    })
  .nullable();

export const RemuneracionesSchema = z.object({
  legajo: z
    .number('El legajo debe ser un número')
    .int('El legajo debe ser un número entero')
    .min(0, 'El legajo debe ser un número mayor a 0')
    .refine(n => isFinite(Number(n)) && !isNaN(n), 'El legajo debe ser un número entero mayor a 0'),
  cuil: z
    .string('El CUIL debe ser una cadena de carateres')
    .min(1, 'El CUIL es obligatorio'),
  apellido_nombre: z
    .string('El CUIL debe ser una cadena de carateres')
    .min(1, 'El CUIL es obligatorio'),
  regimen_laboral: z
    .string('El regimen laboral debe ser una cadena de carateres')
    .min(1, 'El regimen laboral es obligatorio'),
  categoria: z
    .string('La categoria debe ser una cadena de carateres')
    .min(1, 'La categoria es obligatorio'),
  sector: z
    .string('La categoria debe ser una cadena de carateres')
    .min(1, 'La categoria es obligatorio'),
  fecha_ingreso: fechaSchema,
  fecha_inicio_servicio: fechaSchema,
  fecha_fin_servicio: fechaFinServicioSchema,
  basico_cargo_salarial: decimalSchema('Básico carga salarial'),
  total_remunerativo: decimalSchema('Total remunerativo'),
  sac: decimalSchema('Sac'),
  cant_hs_extra_50: z
    .number('La cantidad de horas extra 50% debe ser un número')
    .int('La cantidad de horas extra 50% debe ser un número entero')
    .min(0, 'La cantidad de horas extra 50% debe ser un número mayor a 0')
    .refine(n => isFinite(Number(n)) && !isNaN(n), 'La cantidad de horas extra 50% debe ser un número entero mayor a 0'),
  importe_hs_extra_50: decimalSchema('Importe hs extras 100%'),
  cant_hs_extra_100: z
  .number('La cantidad de horas extra 100% debe ser un número')
  .int('La cantidad de horas extra 100% debe ser un número entero')
  .min(0, 'La cantidad de horas extra 100% debe ser un número mayor a 0')
  .refine(n => isFinite(Number(n)) && !isNaN(n), 'La cantidad de horas extra 100% debe ser un número entero mayor a 0'),
  importe_hs_extra_100: decimalSchema('Importe hs extras 100%'),
  total_no_remunerativo: decimalSchema('Total no remunerativo'),
  total_ropa: decimalSchema('Total ropa'),
  total_bonos: decimalSchema('Total bonos'),
  asignaciones_familiares: decimalSchema('Asignaciones familiares'),
  total_descuentos: decimalSchema('Total descuentos'),
  total_issn: decimalSchema('Total ISSN'),
  art: decimalSchema('ART'),
  seguro_vida_obligatorio: decimalSchema('Seguro Vida Obligatorio'),
  neto_a_cobrar: decimalSchema('Neto a cobrar')
});
