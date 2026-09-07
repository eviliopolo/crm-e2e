import { guardPresupuestoConfirmado } from './guard-presupuesto-confirmado';
import { guard2InfluenciasEnVerde } from './guard-2-influencias-en-verde';
import { guardUsuarioEsComercialDelOUV } from './guard-usuario-es-comercial-del-ouv';
import { EntityType } from '../enums/entity-type.enum';
import type { WorkflowGuardContext } from '../types/workflow.types';

function baseCtx(
  overrides: Partial<WorkflowGuardContext> = {},
): WorkflowGuardContext {
  return {
    entityType: EntityType.OUV,
    entityId: 'ouv-1',
    entityLabel: 'OUV-0001',
    actorUserId: 'user-1',
    estadoAnterior: 'UNIVERSO',
    estadoNuevo: 'ENCIMA_FUNNEL',
    payload: {},
    entity: { estado: 'UNIVERSO' },
    ...overrides,
  };
}

describe('guardPresupuestoConfirmado', () => {
  it('allows non-ENCIMA_FUNNEL destinations without presupuesto', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({
        payload: { zona_nueva: 'EN_FUNNEL', presupuesto_confirmado: false },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects ENCIMA_FUNNEL without presupuesto_confirmado', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({
        payload: { zona_nueva: 'ENCIMA_FUNNEL', presupuesto_confirmado: false },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.guard).toBe('guardPresupuestoConfirmado');
    }
  });

  it('allows ENCIMA_FUNNEL with presupuesto_confirmado', async () => {
    const result = await guardPresupuestoConfirmado(
      baseCtx({
        payload: { zona_nueva: 'ENCIMA_FUNNEL', presupuesto_confirmado: true },
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('guard2InfluenciasEnVerde', () => {
  it('allows ENCIMA_FUNNEL without verde count', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({ payload: { zona_nueva: 'ENCIMA_FUNNEL' } }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects EN_FUNNEL with fewer than 2 verdes', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({
        payload: { zona_nueva: 'EN_FUNNEL', influencias_verde_count: 1 },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('allows MAYOR_PROBABILIDAD with 2 verdes', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({
        payload: {
          zona_nueva: 'MAYOR_PROBABILIDAD',
          influencias_verde_count: 2,
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects EN_FUNNEL when verde count is 0 (Verde without contact does not count)', async () => {
    const result = await guard2InfluenciasEnVerde(
      baseCtx({
        payload: { zona_nueva: 'EN_FUNNEL', influencias_verde_count: 0 },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detalle).toMatch(/contacto asignado/);
    }
  });
});

describe('guardUsuarioEsComercialDelOUV', () => {
  it('rejects when comercial_id missing', () => {
    const result = guardUsuarioEsComercialDelOUV(baseCtx());
    expect(result.ok).toBe(false);
  });

  it('rejects when actor is not owner', () => {
    const result = guardUsuarioEsComercialDelOUV(
      baseCtx({
        actorUserId: 'user-1',
        payload: { comercial_id: 'user-2' },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('allows owner', () => {
    const result = guardUsuarioEsComercialDelOUV(
      baseCtx({
        actorUserId: 'user-1',
        payload: { comercial_id: 'user-1' },
      }),
    );
    expect(result.ok).toBe(true);
  });
});
