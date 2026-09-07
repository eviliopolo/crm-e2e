import { useCallback, useEffect, useState } from 'react';
import { Filter, LayoutGrid, List } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Pagination } from '../../../components/Pagination';
import { AppLayout } from '../../../layout/AppLayout';
import { formatAmountEsCo, formatDateTime } from '../../../lib/format';
import {
  IN_APP_NOTIFICATION_EVENT,
  type InAppNotificationEventDetail,
} from '../../../lib/notification-events';
import { useAuth } from '../../auth/hooks/useAuth';
import { fetchOuvs, type Ouv } from '../api/ouvs-api';
import { CrearOuvDirectaModal } from '../components/CrearOuvDirectaModal';
import { DiscoveryNav } from '../components/DiscoveryNav';
import { GapBadge, ResultadoBadge, ZonaBadge } from '../components/OuvBadges';
import {
  cardClass,
  ghostButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from '../components/ui';
import {
  bandejaFromPath,
  OUV_BANDEJA_UI,
  type OuvBandejaKey,
} from '../lib/ouv-bandejas';
import {
  countActiveOuvFilters,
  EMPTY_OUV_FILTERS,
  type DraftFilters,
} from '../lib/ouv-filters';
import {
  isOuvNotificationEvent,
  OUV_ZONA_LABEL,
  OUV_ZONAS,
  type OuvZona,
} from '../lib/ouv-vocab';

const PAGE_SIZE = 20;
const KANBAN_LIMIT = 30;

type ViewMode = 'lista' | 'kanban';

function formatWonAmount(ouv: Ouv): string {
  if (!ouv.monto_final) return '—';
  const amount = formatAmountEsCo(ouv.monto_final);
  return ouv.moneda_final ? `${amount} ${ouv.moneda_final}` : amount;
}

export function OuvsBoardPage() {
  const { pathname } = useLocation();
  const bandeja = bandejaFromPath(pathname);
  return <OuvsTray key={bandeja} bandeja={bandeja} />;
}

function OuvsTray({ bandeja }: { bandeja: OuvBandejaKey }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEjecutivo = user?.role_name === 'EjecutivoComercial';
  const isSoporte = user?.role_name === 'SoporteComercial';
  const canListAll =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';
  const isClosedTray = bandeja !== 'EnCurso';
  const ui = OUV_BANDEJA_UI[bandeja];

  const [view, setView] = useState<ViewMode>(isClosedTray ? 'lista' : 'kanban');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_OUV_FILTERS);
  const [applied, setApplied] = useState<DraftFilters>(EMPTY_OUV_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Ouv[]>([]);
  const [total, setTotal] = useState(0);
  const [kanban, setKanban] = useState<Record<OuvZona, Ouv[]>>({
    UNIVERSO: [],
    ENCIMA_FUNNEL: [],
    EN_FUNNEL: [],
    MAYOR_PROBABILIDAD: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const hasActiveFilters = countActiveOuvFilters(applied) > 0;

  const queryBase = useCallback(() => {
    return {
      q: applied.q || undefined,
      zona: (applied.zona as OuvZona) || undefined,
      resultado: bandeja,
      tiene_gap:
        applied.tiene_gap === ''
          ? undefined
          : applied.tiene_gap === 'true',
      created_from: applied.created_from || undefined,
      created_to: applied.created_to || undefined,
      all: canListAll || undefined,
    };
  }, [applied, canListAll, bandeja]);

  const loadLista = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError(null);
      try {
        const data = await fetchOuvs({
          ...queryBase(),
          page,
          limit: PAGE_SIZE,
        });
        setItems(data.items);
        setTotal(data.total);
      } catch {
        setError(ui.error);
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [page, queryBase, ui.error],
  );

  const loadKanban = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError(null);
      try {
        const base = queryBase();
        const results = await Promise.all(
          OUV_ZONAS.map((zona) =>
            fetchOuvs({
              ...base,
              zona: base.zona || zona,
              page: 1,
              limit: KANBAN_LIMIT,
            }),
          ),
        );
        const next: Record<OuvZona, Ouv[]> = {
          UNIVERSO: [],
          ENCIMA_FUNNEL: [],
          EN_FUNNEL: [],
          MAYOR_PROBABILIDAD: [],
        };
        OUV_ZONAS.forEach((zona, i) => {
          next[zona] = base.zona && base.zona !== zona ? [] : results[i].items;
        });
        setKanban(next);
      } catch {
        setError(ui.errorKanban);
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [queryBase, ui.errorKanban],
  );

  useEffect(() => {
    if (view === 'lista') {
      void loadLista();
    } else {
      void loadKanban();
    }
  }, [view, loadLista, loadKanban]);

  useEffect(() => {
    function onNotification(event: Event) {
      const detail = (event as CustomEvent<InAppNotificationEventDetail>)
        .detail;
      if (isOuvNotificationEvent(detail?.event_type)) {
        if (view === 'lista') void loadLista({ silent: true });
        else void loadKanban({ silent: true });
      }
    }
    window.addEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
    return () =>
      window.removeEventListener(IN_APP_NOTIFICATION_EVENT, onNotification);
  }, [view, loadLista, loadKanban]);

  function handleApply() {
    setApplied(draft);
    setPage(1);
  }

  function handleClearFilters() {
    setDraft(EMPTY_OUV_FILTERS);
    setApplied(EMPTY_OUV_FILTERS);
    setPage(1);
  }

  const toolbarIconClass = (active: boolean) =>
    [
      'grid h-9 w-9 place-items-center rounded',
      active ? 'btn-glow text-white' : 'icon-btn',
    ].join(' ');

  const emptyMessage = hasActiveFilters ? ui.emptyFiltered : ui.empty;

  return (
    <AppLayout title="Oportunidades (OUV)">
      <DiscoveryNav showAdminTabs={false} />
      {isSoporte ? (
        <p className="mb-3 rounded border border-border bg-bg px-3 py-2 text-sm text-ink">
          {ui.soporteHint}
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink">
          {isSoporte ? ui.titleSoporte : ui.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toolbarIconClass(view === 'kanban')}
            onClick={() => setView('kanban')}
            aria-label="Vista Tablero"
            aria-pressed={view === 'kanban'}
            title="Tablero"
          >
            <LayoutGrid size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarIconClass(view === 'lista')}
            onClick={() => setView('lista')}
            aria-label="Vista Lista"
            aria-pressed={view === 'lista'}
            title="Lista"
          >
            <List size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={toolbarIconClass(filtersOpen)}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-label="Mostrar filtros"
            aria-pressed={filtersOpen}
            aria-expanded={filtersOpen}
            aria-controls="ouv-filters-panel"
            title="Filtros"
          >
            <Filter size={18} strokeWidth={1.75} />
          </button>
          {isEjecutivo && bandeja === 'EnCurso' ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => setShowCreate(true)}
            >
              Crear OUV directa
            </button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div id="ouv-filters-panel" className={`${cardClass} mb-4 p-4`}>
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <label className={labelClass} htmlFor="f-q">
                Buscar
              </label>
              <input
                id="f-q"
                className={inputClass}
                value={draft.q}
                onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                placeholder="Título, empresa, OUV-"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="f-zona">
                Zona
              </label>
              <select
                id="f-zona"
                className={inputClass}
                value={draft.zona}
                onChange={(e) => setDraft({ ...draft, zona: e.target.value })}
              >
                <option value="">Todas</option>
                {OUV_ZONAS.map((z) => (
                  <option key={z} value={z}>
                    {OUV_ZONA_LABEL[z]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="f-gap">
                Gap
              </label>
              <select
                id="f-gap"
                className={inputClass}
                value={draft.tiene_gap}
                onChange={(e) =>
                  setDraft({ ...draft, tiene_gap: e.target.value })
                }
              >
                <option value="">Todos</option>
                <option value="true">Con gap</option>
                <option value="false">Sin gap</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="f-from">
                Desde
              </label>
              <input
                id="f-from"
                type="date"
                className={inputClass}
                value={draft.created_from}
                onChange={(e) =>
                  setDraft({ ...draft, created_from: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="f-to">
                Hasta
              </label>
              <input
                id="f-to"
                type="date"
                className={inputClass}
                value={draft.created_to}
                onChange={(e) =>
                  setDraft({ ...draft, created_to: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className={primaryButtonClass} onClick={handleApply}>
              Aplicar filtros
            </button>
            <button
              type="button"
              className={ghostButtonClass}
              onClick={handleClearFilters}
            >
              Limpiar
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      {view === 'lista' ? (
        <>
          <div className={cardClass}>
            {isLoading ? (
              <p className="p-6 text-sm text-muted">Cargando…</p>
            ) : items.length === 0 ? (
              <div className="p-6">
                <p className="text-sm text-muted">{emptyMessage}</p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className={`${ghostButtonClass} mt-3`}
                    onClick={handleClearFilters}
                  >
                    Limpiar filtros
                  </button>
                ) : null}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 font-bold">Consecutivo</th>
                    <th className="px-4 py-3 font-bold">Título</th>
                    <th className="px-4 py-3 font-bold">Empresa</th>
                    <th className="px-4 py-3 font-bold">Zona</th>
                    {isClosedTray ? (
                      <>
                        <th className="px-4 py-3 font-bold">
                          {bandeja === 'Ganada' ? 'Monto' : 'Motivo'}
                        </th>
                        <th className="px-4 py-3 font-bold">Cierre</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 font-bold">Resultado</th>
                        <th className="px-4 py-3 font-bold">Creada</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((ouv) => (
                    <tr key={ouv.ouv_id} className="border-b border-border">
                      <td className="px-4 py-3">
                        <Link
                          to={`/opportunities/${ouv.ouv_id}`}
                          className="font-bold text-accent hover:underline"
                        >
                          {ouv.consecutivo}
                        </Link>
                        {ouv.tiene_gap ? (
                          <span className="ml-2">
                            <GapBadge />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink">{ouv.titulo}</td>
                      <td className="px-4 py-3 text-ink">
                        {ouv.empresa_nombre}
                      </td>
                      <td className="px-4 py-3">
                        <ZonaBadge zona={ouv.zona_actual} />
                      </td>
                      {isClosedTray ? (
                        <>
                          <td className="px-4 py-3 text-ink">
                            {bandeja === 'Ganada'
                              ? formatWonAmount(ouv)
                              : ouv.motivo_snapshot || '—'}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {formatDateTime(ouv.fecha_cierre)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <ResultadoBadge resultado={ouv.resultado} />
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {formatDateTime(ouv.created_at)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-4">
            <Pagination
              page={page}
              total={total}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </>
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
          {OUV_ZONAS.map((zona) => (
            <div key={zona} className={`${cardClass} min-h-64 p-3`}>
              <h2 className="mb-3 text-sm font-bold text-ink">
                {OUV_ZONA_LABEL[zona]}
              </h2>
              {isLoading ? (
                <p className="text-xs text-muted">Cargando…</p>
              ) : kanban[zona].length === 0 ? (
                <p className="text-xs text-muted">Vacío</p>
              ) : (
                <ul className="space-y-2">
                  {kanban[zona].map((ouv) => (
                    <li key={ouv.ouv_id}>
                      <Link
                        to={`/opportunities/${ouv.ouv_id}`}
                        className="block rounded border border-border bg-bg p-2 hover:border-accent"
                      >
                        <p className="text-xs font-bold text-accent">
                          {ouv.consecutivo}
                        </p>
                        <p className="text-sm text-ink">{ouv.titulo}</p>
                        <p className="text-xs text-muted">
                          {ouv.empresa_nombre}
                        </p>
                        {bandeja === 'Ganada' && ouv.monto_final ? (
                          <p className="mt-1 text-xs text-muted">
                            {formatWonAmount(ouv)}
                          </p>
                        ) : isClosedTray && ouv.motivo_snapshot ? (
                          <p className="mt-1 text-xs text-muted">
                            {ouv.motivo_snapshot}
                          </p>
                        ) : null}
                        {ouv.tiene_gap ? (
                          <span className="mt-1 inline-block">
                            <GapBadge />
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate ? (
        <CrearOuvDirectaModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            navigate(`/opportunities/${id}`);
          }}
        />
      ) : null}
    </AppLayout>
  );
}

export default OuvsBoardPage;
