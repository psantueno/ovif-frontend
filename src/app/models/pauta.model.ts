export type PautaTipo = 'gastos_recursos' | 'recaudaciones_remuneraciones' | 'recaudaciones_personal' | string;
export type ModuloPauta = 'gastos' | 'recursos' | 'recaudaciones' | 'remuneraciones';

const TIPO_PAUTA_LABELS: Record<string, string> = {
  gastos_recursos: 'Gastos y Recursos',
  recaudaciones_remuneraciones: 'Recaudaciones y Remuneraciones',
  recaudaciones_personal: 'Recaudaciones y Remuneraciones'
};

export function obtenerEtiquetaTipoPauta(tipo: PautaTipo | null | undefined): string | null {
  if (!tipo) {
    return null;
  }
  const label = TIPO_PAUTA_LABELS[tipo];
  return label ?? formatearSlug(tipo);
}

export function mapTipoPautaToModulos(tipo: PautaTipo | null | undefined): ModuloPauta[] {
  if (!tipo) {
    return [];
  }

  if (tipo === 'gastos_recursos') {
    return ['gastos', 'recursos'];
  }

  if (tipo === 'recaudaciones_remuneraciones' || tipo === 'recaudaciones_personal') {
    return ['recaudaciones', 'remuneraciones'];
  }

  return [];
}

function formatearSlug(value: string): string {
  return value
    .split('_')
    .map((chunk) => {
      const lowerChunk = chunk.toLowerCase();
      return lowerChunk.charAt(0).toUpperCase() + lowerChunk.slice(1);
    })
    .join(' ');
}
