import { Op, type WhereOptions } from 'sequelize';
import { InfluenciaEstado } from '../models/enums/ouv.enums';
import type { OuvInfluencia } from '../models/ouv-influencia.model';

/**
 * Verde only counts toward EN_FUNNEL / MAYOR_PROBABILIDAD when a contact
 * is assigned. Color without a named influence is not a complete criterion.
 */
export function verdeWithAssignedContactWhere(
  ouvId: string,
): WhereOptions<OuvInfluencia> {
  return {
    ouvId,
    estado: InfluenciaEstado.Verde,
    contactoOuvId: { [Op.ne]: null },
  };
}

export function isVerdeWithAssignedContact(row: {
  estado: string;
  contactoOuvId: string | null | undefined;
}): boolean {
  return (
    row.estado === InfluenciaEstado.Verde &&
    typeof row.contactoOuvId === 'string' &&
    row.contactoOuvId.length > 0
  );
}
