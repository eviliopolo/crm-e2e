export const OUV_ZONAS = [
  'UNIVERSO',
  'ENCIMA_FUNNEL',
  'EN_FUNNEL',
  'MAYOR_PROBABILIDAD',
] as const;

export type OuvZona = (typeof OUV_ZONAS)[number];

export const OUV_ZONA_LABEL: Record<OuvZona, string> = {
  UNIVERSO: 'Universo',
  ENCIMA_FUNNEL: 'Encima Funnel',
  EN_FUNNEL: 'En Funnel',
  MAYOR_PROBABILIDAD: 'Mayor Probabilidad',
};

/** Labels for the funnel traceability ribbon (uppercase, per blueprint). */
export const OUV_ZONA_RIBBON_LABEL: Record<OuvZona, string> = {
  UNIVERSO: 'UNIVERSO',
  ENCIMA_FUNNEL: 'ENCIMA DEL FUNNEL',
  EN_FUNNEL: 'FUNNEL',
  MAYOR_PROBABILIDAD: 'MAYOR PROBABILIDAD',
};

export function nextOuvZona(zona: OuvZona): OuvZona | null {
  const idx = OUV_ZONAS.indexOf(zona);
  if (idx < 0 || idx >= OUV_ZONAS.length - 1) return null;
  return OUV_ZONAS[idx + 1];
}

export function prevOuvZona(zona: OuvZona): OuvZona | null {
  const idx = OUV_ZONAS.indexOf(zona);
  if (idx <= 0) return null;
  return OUV_ZONAS[idx - 1];
}

/** Guards that the motor will evaluate for the destination zona. */
export function guardsForDestino(
  destino: OuvZona,
): { code: string; label: string }[] {
  const guards: { code: string; label: string }[] = [
    {
      code: 'guardUsuarioEsComercialDelOUV',
      label: 'Debes ser el comercial dueño de la OUV',
    },
  ];
  if (destino === 'ENCIMA_FUNNEL') {
    guards.push({
      code: 'guardPresupuestoConfirmado',
      label: 'Presupuesto confirmado',
    });
  }
  if (destino === 'EN_FUNNEL' || destino === 'MAYOR_PROBABILIDAD') {
    guards.push({
      code: 'guard2InfluenciasEnVerde',
      label: 'Al menos 2 influencias en Verde con contacto asignado',
    });
  }
  return guards;
}

export const OUV_RESULTADOS = [
  'EnCurso',
  'Ganada',
  'Perdida',
  'Descartada',
] as const;

export type OuvResultado = (typeof OUV_RESULTADOS)[number];

export const OUV_RESULTADO_LABEL: Record<OuvResultado, string> = {
  EnCurso: 'En curso',
  Ganada: 'Ganada',
  Perdida: 'Perdida',
  Descartada: 'Descartada',
};

export const INFLUENCIA_TIPOS = ['Economica', 'Tecnica', 'Fabrica'] as const;
export type InfluenciaTipo = (typeof INFLUENCIA_TIPOS)[number];

export const INFLUENCIA_TIPO_LABEL: Record<InfluenciaTipo, string> = {
  Economica: 'Económica',
  Tecnica: 'Técnica',
  Fabrica: 'Fábrica',
};

export const INFLUENCIA_ESTADOS = [
  'SinEvaluar',
  'Verde',
  'Amarillo',
  'Rojo',
] as const;

export type InfluenciaEstado = (typeof INFLUENCIA_ESTADOS)[number];

/** Verde only counts for EN_FUNNEL / MAYOR_PROBABILIDAD with a contact. */
export function isVerdeWithAssignedContact(row: {
  estado: string;
  contacto_ouv_id: string | null | undefined;
}): boolean {
  return row.estado === 'Verde' && Boolean(row.contacto_ouv_id);
}

export function countVerdeWithAssignedContact(
  rows: { estado: string; contacto_ouv_id: string | null | undefined }[],
): number {
  return rows.filter(isVerdeWithAssignedContact).length;
}

export const INFLUENCIA_ESTADO_LABEL: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'Sin Evaluar',
  Verde: 'Verde',
  Amarillo: 'Amarillo',
  Rojo: 'Rojo',
};

/** Card / select tones for influencia estado (semaphore). */
export const INFLUENCIA_ESTADO_TONE: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'border-border bg-bg text-muted',
  Verde: 'border-semaphore-verde/50 bg-semaphore-verde/10 text-ink',
  Amarillo: 'border-warning/50 bg-warning/15 text-ink',
  Rojo: 'border-danger/50 bg-danger/10 text-danger',
};


export const INFLUENCIA_ESTADO_DOT: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'bg-muted',
  Verde: 'bg-semaphore-verde',
  Amarillo: 'bg-warning',
  Rojo: 'bg-danger',
};

/** Full-card background when a contact is assigned. */
export const INFLUENCIA_ESTADO_CARD: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'border-border bg-bg/90',
  Verde: 'border-semaphore-verde/70 bg-semaphore-verde/20',
  Amarillo: 'border-warning/70 bg-warning/25',
  Rojo: 'border-danger/70 bg-danger/15',
};

export const VERTICALES = [
  'Seguridad Ciudadana',
  'Defensa',
  'Telecomunicaciones',
  'Smart Cities',
  'Infraestructura Crítica',
  'Educación',
  'Salud',
  'Otros',
] as const;

export const SEGMENTOS = [
  'Gobierno',
  'D&S',
  'ProyectosEspeciales',
  'B2B',
] as const;

export const OUV_EVENT_PREFIX = 'ouv.';

export function isOuvNotificationEvent(eventType: string | undefined): boolean {
  return Boolean(eventType?.startsWith(OUV_EVENT_PREFIX));
}
