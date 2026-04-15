/**
 * Elimina espacios, normaliza separadores de miles y decimales, y valida formato numérico.
 * Acepta números enteros y decimales con hasta 2 dígitos decimales.
 * Retorna null si el valor no es un número válido o no cumple las condiciones.
 * @param value
 * @param sep
 * @returns El número normalizado o null si no es válido
 */
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

/**
 * Normaliza un valor numérico desde una cadena, manejando espacios, separadores de miles y decimales.
 * Valida que el resultado sea un número entero mayor a 0 o un decimal con hasta 2 dígitos decimales.
 * Agrega mensajes de error al array proporcionado si la validación falla.
 * @param value
 * @returns El número normalizado o null si no es válido
 */
const normalizarValorNumerico = (value: string): { value: number | null; decimalPlaces: number } => {
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

/**
 * Normaliza un número entero desde una cadena, validando que sea un número entero mayor a 0.
 * Agrega mensajes de error al array proporcionado si la validación falla.
 * @param raw
 * @param campo
 * @param errores
 * @returns El número entero normalizado o null si no es válido
 */
export const normalizarNumeroEntero = (raw: string, campo: string, errores: string[], allowZero: boolean = false): number | null => {
  if (!raw) {
    errores.push(`El campo ${campo} es obligatorio.`);
    return null;
  }

  const result = normalizarValorNumerico(raw);

  if (result.value === null || !Number.isInteger(result.value) || (result.value <= 0 && !allowZero)) {
    errores.push(`El campo ${campo} debe ser un número entero mayor a 0.`);
    return null;
  }

  return result.value;
};

/**
 * Normaliza un número decimal desde una cadena, validando que sea un número con hasta 2 dígitos decimales.
 * Agrega mensajes de error al array proporcionado si la validación falla.
 * @param raw
 * @param campo
 * @param errores
 * @returns El número decimal normalizado o null si no es válido
 */
export const normalizarNumeroDecimal = (raw: string, campo: string, errores: string[]): number | null => {
  if (!raw) {
    errores.push(`El campo ${campo} es obligatorio.`);
    return null;
  }

  const parsedImporte = normalizarValorNumerico(raw);
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
