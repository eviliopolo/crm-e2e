import { useEffect, useState } from 'react';
import { ApiError } from '../../auth/types';
import {
  avanzarOuv,
  fetchOuvChecklist,
  type Ouv,
  type OuvChecklistItem,
} from '../api/ouvs-api';
import {
  countVerdeWithAssignedContact,
  guardsForDestino,
  INFLUENCIA_TIPO_LABEL,
  nextOuvZona,
  OUV_ZONA_LABEL,
  type InfluenciaTipo,
} from '../lib/ouv-vocab';
import { ModalShell } from './ModalShell';
import { ghostButtonClass, primaryButtonClass } from './ui';

type InfluenciaAdvanceRow = {
  tipo: InfluenciaTipo | string;
  estado: string;
  contacto_ouv_id: string | null;
};

type Props = {
  ouv: Ouv;
  influencias: InfluenciaAdvanceRow[];
  onClose: () => void;
  onAdvanced: () => void;
};

export function AvanceZonaModal({
  ouv,
  influencias,
  onClose,
  onAdvanced,
}: Props) {
  const destino = nextOuvZona(ouv.zona_actual);
  const [items, setItems] = useState<OuvChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!destino) {
      setLoading(false);
      return;
    }
    void fetchOuvChecklist(ouv.ouv_id, destino)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [destino, ouv.ouv_id]);

  if (!destino) {
    return (
      <ModalShell title="Avanzar zona" onClose={onClose}>
        <p className="text-sm text-muted">
          Ya estás en la última zona (Mayor Probabilidad). Usa Cerrar → Ganada.
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" className={ghostButtonClass} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </ModalShell>
    );
  }

  const guards = guardsForDestino(destino);
  const requiresVerde =
    destino === 'EN_FUNNEL' || destino === 'MAYOR_PROBABILIDAD';
  const verdeCount = countVerdeWithAssignedContact(influencias);
  const verdesSinContacto = influencias.filter(
    (row) => row.estado === 'Verde' && !row.contacto_ouv_id,
  );
  const bloqueadoPorInfluencias = requiresVerde && verdeCount < 2;

  async function confirm() {
    if (bloqueadoPorInfluencias) {
      setError(
        'Asigna un contacto a al menos 2 influencias en Verde antes de avanzar.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await avanzarOuv(ouv.ouv_id);
      onAdvanced();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo avanzar de zona.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Confirmar avance de zona" onClose={onClose} size="wide">
      <p className="mb-3 text-sm text-ink">
        {OUV_ZONA_LABEL[ouv.zona_actual]} →{' '}
        <strong>{OUV_ZONA_LABEL[destino]}</strong>
      </p>

      <h3 className="mb-2 text-xs font-bold uppercase text-muted">
        Guards a evaluar
      </h3>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink">
        {guards.map((g) => (
          <li key={g.code}>{g.label}</li>
        ))}
      </ul>

      {requiresVerde ? (
        <p
          className={`mb-4 text-sm ${bloqueadoPorInfluencias ? 'text-danger' : 'text-ink'}`}
          role={bloqueadoPorInfluencias ? 'alert' : undefined}
        >
          {verdeCount}/2 influencias en Verde con contacto.
          {verdesSinContacto.length > 0
            ? ` No cuentan: ${verdesSinContacto
                .map(
                  (row) =>
                    INFLUENCIA_TIPO_LABEL[row.tipo as InfluenciaTipo] ??
                    row.tipo,
                )
                .join(', ')} (Verde sin contacto).`
            : ''}
        </p>
      ) : null}

      <h3 className="mb-2 text-xs font-bold uppercase text-muted">
        Checklist zona destino
      </h3>
      {loading ? (
        <p className="text-sm text-muted">Cargando checklist…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">
          Sin plantillas para esta zona (se sembrarán al avanzar si existen).
        </p>
      ) : (
        <ul className="mb-4 space-y-1 text-sm text-ink">
          {items.map((item) => (
            <li key={item.item_id}>
              {item.marcado ? '☑' : '☐'} {item.label}
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button type="button" className={ghostButtonClass} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={saving || bloqueadoPorInfluencias}
          onClick={() => void confirm()}
        >
          {saving ? 'Avanzando…' : 'Confirmar avance'}
        </button>
      </div>
    </ModalShell>
  );
}
