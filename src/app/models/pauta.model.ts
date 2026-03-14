export type PautaTipoCodigo = 'gastos_recursos' | 'recaudaciones_remuneraciones' | string;
export type ModuloPauta = 'gastos' | 'recursos' | 'recaudaciones' | 'remuneraciones';

export interface PautaTipoMetadata {
  tipo_pauta_id: number | null;
  tipo_pauta_codigo: PautaTipoCodigo | null;
  tipo_pauta_nombre?: string | null;
  tipo_pauta_descripcion?: string | null;
  requiere_periodo_rectificar?: boolean | null;
}

export function obtenerEtiquetaTipoPauta(tipo: PautaTipoCodigo | null | undefined): string | null {
  if (!tipo) {
    return null;
  }
  return String(tipo);
}

export function mapTipoPautaToModulos(tipo: PautaTipoCodigo | null | undefined): ModuloPauta[] {
  if (!tipo) {
    return [];
  }

  if (tipo === 'gastos_recursos') {
    return ['gastos', 'recursos'];
  }

  if (tipo === 'recaudaciones_remuneraciones') {
    return ['recaudaciones', 'remuneraciones'];
  }

  return [];
}
