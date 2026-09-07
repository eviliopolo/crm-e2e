import type { OuvResultado } from './ouv-vocab';

export type OuvBandejaKey = 'EnCurso' | 'Ganada' | 'Perdida' | 'Descartada';

export const OUV_BANDEJA_PATHS: Record<OuvBandejaKey, string> = {
  EnCurso: '/opportunities',
  Ganada: '/opportunities/ganadas',
  Perdida: '/opportunities/perdidas',
  Descartada: '/opportunities/descartadas',
};

export function bandejaFromPath(pathname: string): OuvBandejaKey {
  if (pathname.startsWith(OUV_BANDEJA_PATHS.Ganada)) return 'Ganada';
  if (pathname.startsWith(OUV_BANDEJA_PATHS.Perdida)) return 'Perdida';
  if (pathname.startsWith(OUV_BANDEJA_PATHS.Descartada)) return 'Descartada';
  return 'EnCurso';
}

export function backLinkForResultado(resultado: OuvResultado): {
  to: string;
  label: string;
} {
  if (resultado === 'Ganada') {
    return {
      to: OUV_BANDEJA_PATHS.Ganada,
      label: '← Oportunidades ganadas',
    };
  }
  if (resultado === 'Perdida') {
    return {
      to: OUV_BANDEJA_PATHS.Perdida,
      label: '← Oportunidades perdidas',
    };
  }
  if (resultado === 'Descartada') {
    return {
      to: OUV_BANDEJA_PATHS.Descartada,
      label: '← Oportunidades descartadas',
    };
  }
  return { to: OUV_BANDEJA_PATHS.EnCurso, label: '← Bandeja OUV' };
}

export const OUV_BANDEJA_UI: Record<
  OuvBandejaKey,
  {
    title: string;
    titleSoporte: string;
    empty: string;
    emptyFiltered: string;
    error: string;
    errorKanban: string;
    soporteHint: string;
  }
> = {
  EnCurso: {
    title: 'Bandeja OUV',
    titleSoporte: 'Bandeja OUV (Soporte)',
    empty: 'Aún no hay OUVs en curso.',
    emptyFiltered: 'No hay OUVs en curso que coincidan con estos filtros.',
    error: 'No se pudo cargar la bandeja de OUVs.',
    errorKanban: 'No se pudo cargar el kanban de OUVs.',
    soporteHint:
      'Bandeja Soporte: ves todas las OUVs en curso (solo lectura de avance/cierre). Administra motivos y plantillas de checklist desde el menú.',
  },
  Ganada: {
    title: 'Oportunidades ganadas',
    titleSoporte: 'Oportunidades ganadas (Soporte)',
    empty: 'Aún no hay oportunidades ganadas.',
    emptyFiltered:
      'No hay oportunidades ganadas que coincidan con estos filtros.',
    error: 'No se pudieron cargar las oportunidades ganadas.',
    errorKanban: 'No se pudo cargar el kanban de oportunidades ganadas.',
    soporteHint:
      'Bandeja Soporte: ves todas las OUVs cerradas como Ganada (solo lectura).',
  },
  Perdida: {
    title: 'Oportunidades perdidas',
    titleSoporte: 'Oportunidades perdidas (Soporte)',
    empty: 'Aún no hay oportunidades perdidas.',
    emptyFiltered:
      'No hay oportunidades perdidas que coincidan con estos filtros.',
    error: 'No se pudieron cargar las oportunidades perdidas.',
    errorKanban: 'No se pudo cargar el kanban de oportunidades perdidas.',
    soporteHint:
      'Bandeja Soporte: ves todas las OUVs cerradas como Perdida (solo lectura).',
  },
  Descartada: {
    title: 'Oportunidades descartadas',
    titleSoporte: 'Oportunidades descartadas (Soporte)',
    empty: 'Aún no hay oportunidades descartadas.',
    emptyFiltered:
      'No hay oportunidades descartadas que coincidan con estos filtros.',
    error: 'No se pudieron cargar las oportunidades descartadas.',
    errorKanban: 'No se pudo cargar el kanban de oportunidades descartadas.',
    soporteHint:
      'Bandeja Soporte: ves todas las OUVs cerradas como Descartada (solo lectura).',
  },
};
