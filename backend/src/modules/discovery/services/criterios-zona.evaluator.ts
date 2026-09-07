import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { verdeWithAssignedContactWhere } from '../lib/ouv-influencia-verde';
import { zonaRank } from '../lib/ouv-zona-order';
import { OuvZona } from '../models/enums/ouv.enums';
import { OuvInfluencia } from '../models/ouv-influencia.model';
import { Ouv } from '../models/ouv.model';

export type CriteriosZonaResult = {
  tieneGap: boolean;
  criteriosFaltantes: string[];
};

/**
 * Evaluates hard zone criteria and persists gap flags (EARS-27..29).
 * Invoked after influencia / checklist / presupuesto changes.
 */
@Injectable()
export class CriteriosZonaEvaluator {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(OuvInfluencia)
    private readonly influenciaModel: typeof OuvInfluencia,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async evaluate(
    ouv: Ouv,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<CriteriosZonaResult> {
    const locked = await this.ouvModel.findByPk(ouv.ouvId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!locked) {
      return { tieneGap: false, criteriosFaltantes: [] };
    }

    const criteriosFaltantes = await this.computeFaltantes(
      locked,
      transaction,
    );
    const tieneGap = criteriosFaltantes.length > 0;
    const gapAnterior = locked.tieneGap;

    await locked.update(
      {
        tieneGap,
        criteriosFaltantes: tieneGap ? criteriosFaltantes : null,
      },
      { transaction },
    );

    // Keep caller's instance in sync
    ouv.tieneGap = tieneGap;
    ouv.criteriosFaltantes = tieneGap ? criteriosFaltantes : null;

    if (!gapAnterior && tieneGap) {
      await this.workflowEngine.transition(
        EntityType.OUV,
        locked.ouvId,
        'ouv.criterios_perdidos',
        {
          estadoAnterior: locked.zonaActual,
          estadoNuevo: locked.zonaActual,
          entityLabel: locked.consecutivo,
          actorUserId,
          payload: {
            comercial_id: locked.comercialId,
            criterios_faltantes: criteriosFaltantes,
          },
          entity: { estado: locked.zonaActual },
        },
        transaction,
      );
    } else if (gapAnterior && !tieneGap) {
      await this.workflowEngine.transition(
        EntityType.OUV,
        locked.ouvId,
        'ouv.criterios_recuperados',
        {
          estadoAnterior: locked.zonaActual,
          estadoNuevo: locked.zonaActual,
          entityLabel: locked.consecutivo,
          actorUserId,
          payload: {
            comercial_id: locked.comercialId,
          },
          entity: { estado: locked.zonaActual },
        },
        transaction,
      );
    }

    return { tieneGap, criteriosFaltantes };
  }

  private async computeFaltantes(
    ouv: Ouv,
    transaction: Transaction,
  ): Promise<string[]> {
    const faltantes: string[] = [];
    const rank = zonaRank(ouv.zonaActual);

    if (rank >= zonaRank(OuvZona.EncimaFunnel) && !ouv.presupuestoConfirmado) {
      faltantes.push('presupuesto_confirmado');
    }

    if (rank >= zonaRank(OuvZona.EnFunnel)) {
      const verdes = await this.influenciaModel.count({
        where: verdeWithAssignedContactWhere(ouv.ouvId),
        transaction,
      });
      if (verdes < 2) {
        faltantes.push('influencias_verde');
      }
    }

    return faltantes;
  }
}
