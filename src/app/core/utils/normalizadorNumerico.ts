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
export const normalizarNumeroEntero = (
  raw: string,
  campo: string,
  errores: string[],
  allowZero: boolean = false,
  maxValue?: number
): number | null => {
  if (!raw) {
    errores.push(`El campo ${campo} es obligatorio.`);
    return null;
  }

  const result = normalizarValorNumerico(raw);

  if (result.value === null || !Number.isInteger(result.value) || (result.value <= 0 && !allowZero)) {
    errores.push(`El campo ${campo} debe ser un número entero mayor a 0.`);
    return null;
  }

  if (maxValue !== undefined && result.value > maxValue) {
    errores.push(`El campo ${campo} no puede superar ${maxValue}.`);
    return null;
  }

  return result.value;
};

/**
 * Normaliza un importe (valor de dinero) leído en crudo desde Excel (raw:true).
 *
 * - Si la celda es un número nativo, se redondea a 2 decimales. Si traía más de
 *   2 decimales reales (diferencia >= medio centavo), se registra una ADVERTENCIA
 *   no bloqueante para que el usuario la revise en la previsualización.
 * - Si la celda NO es un número nativo (típicamente formato Texto/General, con
 *   separadores de miles), se registra un ERROR bloqueante: los importes deben
 *   venir en formato Número en Excel. No se intenta interpretar separadores.
 *
 * @param raw Valor crudo de la celda (number | string | null | undefined).
 * @param campo Nombre del campo, para los mensajes.
 * @param errores Array de errores bloqueantes.
 * @param advertencias Array de advertencias no bloqueantes.
 * @returns El importe redondeado a 2 decimales, o null si no es válido.
 */
export const normalizarNumeroDecimal = (
  raw: unknown,
  campo: string,
  errores: string[],
  advertencias: string[] = [],
): number | null => {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    errores.push(`El campo ${campo} es obligatorio.`);
    return null;
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      errores.push(`El campo ${campo} debe ser un número válido.`);
      return null;
    }

    const centavos = raw * 100;
    const centavosRedondeados = Math.round(centavos);
    const redondeado = centavosRedondeados / 100;

    // Si el importe expresado en centavos no es prácticamente entero, la celda
    // traía más de 2 decimales reales: lo redondeamos y avisamos (advertencia no
    // bloqueante). La tolerancia (medio milésimo de centavo) absorbe las
    // imprecisiones propias del punto flotante y evita falsas alarmas.
    if (Math.abs(centavos - centavosRedondeados) > 0.001) {
      const valorFormateado = redondeado.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      advertencias.push(
        `El importe de ${campo} tenía más de 2 decimales y se redondeó a ${valorFormateado}.`,
      );
    }

    return redondeado;
  }

  errores.push(
    `El campo ${campo} debe tener formato Número en Excel (no Texto). ` +
      `Reformateá la celda como número y volvé a cargar.`,
  );
  return null;
};
