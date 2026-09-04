import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { AppLayout } from '../../../layout/AppLayout';
import { fetchOuv, type Ouv } from '../../discovery/api/ouvs-api';
import { OuvReadonlyHeaderCard } from '../../discovery/components/OuvReadonlyHeaderCard';
import { loadOuvExtensions } from '../../discovery/lib/ouv-detail-extensions';
import type { OuvDetailExtensions } from '../../discovery/lib/ouv-detail-extensions';
import {
  getVentaGanada,
  puedeEnviarAPmo,
  puedeEnviarKickoff,
  upsertVentaGanada,
} from '../../shared/project/mock-store';
import type {
  ValidacionTipo,
  VentaGanadaRecord,
} from '../../shared/project/types';
import {
  VALIDACION_ESTADO_LABEL,
  VALIDACION_TIPOS,
} from '../../shared/project/types';
import { FormularioDatosProyecto } from '../components/FormularioDatosProyecto';
import { KickoffCard } from '../components/KickoffCard';
import { ResumenEnvioPmoModal } from '../components/ResumenEnvioPmoModal';
import { SharePointPreviewModal } from '../components/SharePointPreviewModal';
import {
  badgeClass,
  cardClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  selectClass,
} from '../components/ui';

type Tab = 'validaciones' | 'kickoff' | 'datos';

function ouvFromVentaRecord(record: VentaGanadaRecord): Ouv {
  const now = new Date().toISOString();
  return {
    ouv_id: record.ouvId,
    consecutivo: record.consecutivo,
    sql_id_origen: null,
    origen_via: 'directa',
    comercial_id: '',
    account_id: null,
    titulo: record.titulo,
    empresa_nombre: record.empresaNombre,
    descripcion: null,
    segmento: 'Gobierno',
    segment_id: null,
    subsegment_id: null,
    vertical: '—',
    zona_actual: 'MAYOR_PROBABILIDAD',
    resultado: 'Ganada',
    tiene_gap: false,
    criterios_faltantes: null,
    presupuesto_confirmado: false,
    presupuesto_monto: null,
    presupuesto_moneda: null,
    presupuesto_fecha_captura: null,
    presupuesto_fuente: null,
    motivo_id: null,
    motivo_snapshot: null,
    motivo_detalle: null,
    competidor_ganador: null,
    monto_final: null,
    moneda_final: null,
    monto_estimado_perdido: null,
    fecha_cierre: null,
    created_at: now,
    updated_at: now,
  };
}

/** Detalle de venta ganada — vista de página (mismo patrón que detalle OUV). */
export function VentaGanadaDetailPage() {
  const { ouvId = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<VentaGanadaRecord | null>(null);
  const [ouv, setOuv] = useState<Ouv | null>(null);
  const [ouvExtensions, setOuvExtensions] = useState<OuvDetailExtensions>({});
  const [tab, setTab] = useState<Tab>('validaciones');
  const [showResumen, setShowResumen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    setRecord(getVentaGanada(ouvId));
  }, [ouvId]);

  useEffect(() => {
    if (!record) {
      setOuv(null);
      return;
    }
    setOuvExtensions(loadOuvExtensions(record.ouvId));
    void fetchOuv(record.ouvId)
      .then(setOuv)
      .catch(() => setOuv(ouvFromVentaRecord(record)));
  }, [record]);

  const kickoffUnlocked = record ? puedeEnviarKickoff(record) : false;
  // TODO: lock Datos proyecto until kickoff checklist step 4 (días) when Teams integration lands.
  const datosUnlocked = true;

  useEffect(() => {
    if (tab === 'kickoff' && !kickoffUnlocked) setTab('validaciones');
  }, [tab, kickoffUnlocked]);

  if (!record) {
    return (
      <AppLayout title="Oferta & Cierre">
        <p className="text-sm text-muted">Registro no encontrado.</p>
        <Link to="/offers" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Bandeja soporte comercial
        </Link>
      </AppLayout>
    );
  }

  function save(next: VentaGanadaRecord) {
    setRecord(upsertVentaGanada(next));
  }

  function setValidacion(
    tipo: ValidacionTipo,
    estado: VentaGanadaRecord['validaciones'][ValidacionTipo]['estado'],
    observacion: string,
  ) {
    if (!record) return;
    const next: VentaGanadaRecord = {
      ...record,
      validaciones: {
        ...record.validaciones,
        [tipo]: {
          ...record.validaciones[tipo],
          estado,
          observacion,
          usuario: 'Usuario actual',
          fecha: new Date().toISOString(),
        },
      },
    };
    next.estadoRevision = Object.values(next.validaciones).every(
      (v) => v.estado === 'Aprobado',
    )
      ? 'Aprobada'
      : 'EnRevision';
    save(next);
  }

  const tabBtn = (
    t: Tab,
    label: string,
    unlocked: boolean,
    lockedTitle?: string,
  ) => (
    <button
      type="button"
      className={`-mb-px border-b-2 px-4 py-2 text-sm ${
        !unlocked
          ? 'cursor-not-allowed border-transparent text-muted/50'
          : tab === t
            ? 'border-accent font-bold text-accent'
            : 'border-transparent text-muted hover:text-accent'
      }`}
      disabled={!unlocked}
      title={!unlocked ? lockedTitle : undefined}
      onClick={() => unlocked && setTab(t)}
    >
      {label}
    </button>
  );

  const headerOuv = ouv ?? ouvFromVentaRecord(record);
  const pmo = puedeEnviarAPmo(record);

  return (
    <AppLayout title={record.consecutivo}>
      <div className="mb-3">
        <Link to="/offers" className="text-sm text-accent hover:underline">
          ← Bandeja soporte comercial
        </Link>
      </div>

      {toast ? (
        <p className="mb-3 rounded border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
          {toast}
        </p>
      ) : null}

      <OuvReadonlyHeaderCard
        ouv={headerOuv}
        extensions={ouvExtensions}
        footer={
          record.envioPmo.estado === 'Enviado' ? (
            <div className={`${badgeClass} bg-positive/15 text-positive`}>
              Enviado · {record.envioPmo.serConsecutivo} · CP{' '}
              {record.envioPmo.consecutivoControlProyectos}
            </div>
          ) : null
        }
      />

      <nav
        className="mb-4 flex flex-wrap items-center gap-1 border-b border-border"
        aria-label="Detalle venta ganada"
      >
        {tabBtn('validaciones', 'Viabilidad', true)}
        {tabBtn(
          'kickoff',
          'Kickoff',
          kickoffUnlocked,
          'Aprueba las viabilidades técnica y financiera para habilitar Kickoff.',
        )}
        {tabBtn('datos', 'Datos proyecto', datosUnlocked)}
        {tab === 'datos' ? (
          <div className="ml-auto flex items-center pb-1">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!pmo.ok}
              title={pmo.reason ?? 'Crear proyecto en Control de Proyectos'}
              onClick={() => setShowResumen(true)}
            >
              Crear Proyecto
            </button>
          </div>
        ) : null}
      </nav>

      {tab === 'validaciones' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {VALIDACION_TIPOS.map((tipo) => {
              const v = record.validaciones[tipo];
              return (
                <div key={tipo} className={`${cardClass} flex h-full flex-col p-4`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-ink">{tipo}</span>
                    <span className="text-xs text-muted">
                      {VALIDACION_ESTADO_LABEL[v.estado]}
                    </span>
                  </div>
                  <select
                    className={selectClass}
                    value={v.estado}
                    onChange={(e) =>
                      setValidacion(
                        tipo,
                        e.target.value as typeof v.estado,
                        v.observacion,
                      )
                    }
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                  </select>
                  <label className={`${labelClass} mt-2`}>Observación</label>
                  <textarea
                    className={`${inputClass} min-h-16 flex-1 py-2`}
                    value={v.observacion}
                    onChange={(e) =>
                      setValidacion(tipo, v.estado, e.target.value)
                    }
                  />

                  <div className="mt-3 rounded border border-border bg-bg p-3">
                    <p className="mb-1 text-xs font-bold text-muted">
                      Documento SharePoint
                    </p>
                    {v.sharepointUrl ? (
                      <button
                        type="button"
                        className="inline-flex max-w-full items-center gap-2 text-left text-sm font-bold text-accent hover:underline"
                        onClick={() =>
                          setPreview({
                            title: v.sharepointNombre ?? 'Documento',
                            url: v.sharepointUrl!,
                          })
                        }
                      >
                        <ExternalLink size={15} aria-hidden />
                        <span className="truncate">
                          {v.sharepointNombre ?? v.sharepointUrl}
                        </span>
                      </button>
                    ) : (
                      <p className="text-xs text-muted">Sin documento vinculado.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {puedeEnviarKickoff(record) ? (
            <p className="text-sm text-positive">
              Viabilidad técnica y financiera aprobada — kickoff habilitado.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'kickoff' ? (
        <KickoffCard
          ouvId={record.ouvId}
          accountId={headerOuv.account_id}
          empresaNombre={headerOuv.empresa_nombre || record.empresaNombre}
          kickoff={record.kickoff}
          onChange={(kickoff) => save({ ...record, kickoff })}
        />
      ) : null}

      {tab === 'datos' ? (
        <FormularioDatosProyecto
          datos={record.datosBase}
          modo="crear"
          onChange={(datosBase) => save({ ...record, datosBase })}
        />
      ) : null}

      <ResumenEnvioPmoModal
        record={record}
        open={showResumen}
        onClose={() => setShowResumen(false)}
        onSent={(updated) => {
          setRecord(updated);
          setToast(
            `Proyecto creado en Control de Proyectos: ${updated.envioPmo.serConsecutivo}`,
          );
          navigate('/services');
        }}
      />

      <SharePointPreviewModal
        open={Boolean(preview)}
        title={preview?.title ?? ''}
        url={preview?.url ?? ''}
        onClose={() => setPreview(null)}
      />
    </AppLayout>
  );
}

export default VentaGanadaDetailPage;
