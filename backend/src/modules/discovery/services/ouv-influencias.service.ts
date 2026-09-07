import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import type { ActualizarInfluenciaDto } from '../dtos/actualizar-influencia.dto';
import { canMutateOuvEnCurso } from '../lib/ouv-access';
import { verdeWithAssignedContactWhere } from '../lib/ouv-influencia-verde';
import {
  InfluenciaEstado,
  InfluenciaTipo,
  OuvResultado,
} from '../models/enums/ouv.enums';
import { OuvContacto } from '../models/ouv-contacto.model';
import { OuvInfluencia } from '../models/ouv-influencia.model';
import { Ouv } from '../models/ouv.model';
import { CriteriosZonaEvaluator } from './criterios-zona.evaluator';

@Injectable()
export class OuvInfluenciasService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(OuvInfluencia)
    private readonly influenciaModel: typeof OuvInfluencia,
    @InjectModel(OuvContacto)
    private readonly contactoModel: typeof OuvContacto,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly criteriosEvaluator: CriteriosZonaEvaluator,
  ) {}

  async seedInfluenciasParaOuv(
    ouvId: string,
    transaction: Transaction,
  ): Promise<OuvInfluencia[]> {
    const rows: OuvInfluencia[] = [];
    for (const tipo of Object.values(InfluenciaTipo)) {
      const row = await this.influenciaModel.create(
        {
          ouvId,
          tipo,
          estado: InfluenciaEstado.SinEvaluar,
          contactoOuvId: null,
        },
        { transaction },
      );
      rows.push(row);
    }
    return rows;
  }

  async listByOuv(ouvId: string): Promise<OuvInfluencia[]> {
    return this.influenciaModel.findAll({
      where: { ouvId },
      order: [['tipo', 'ASC']],
    });
  }

  async countVerde(ouvId: string, transaction?: Transaction): Promise<number> {
    return this.influenciaModel.count({
      where: verdeWithAssignedContactWhere(ouvId),
      transaction,
    });
  }

  async actualizarEstado(
    ouvId: string,
    tipo: InfluenciaTipo,
    dto: ActualizarInfluenciaDto,
    actorUserId: string,
    roleName: string,
  ): Promise<OuvInfluencia> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.ouvModel.findByPk(ouvId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!ouv) {
        throw new NotFoundException(`OUV ${ouvId} not found`);
      }
      if (!canMutateOuvEnCurso(ouv.comercialId, actorUserId, roleName)) {
        throw new ForbiddenException(
          'Only the owning Ejecutivo Comercial or Admin can update influencias',
        );
      }
      if (ouv.resultado !== OuvResultado.EnCurso) {
        throw new BadRequestException(
          `Cannot update influencias on a closed OUV (resultado=${ouv.resultado})`,
        );
      }

      const influencia = await this.influenciaModel.findOne({
        where: { ouvId, tipo },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!influencia) {
        throw new NotFoundException(
          `Influencia ${tipo} not found for OUV ${ouvId}`,
        );
      }

      if (dto.contacto_ouv_id) {
        const contacto = await this.contactoModel.findByPk(
          dto.contacto_ouv_id,
          { transaction },
        );
        if (!contacto || contacto.ouvId !== ouvId) {
          throw new BadRequestException(
            'contacto_ouv_id must belong to the same OUV',
          );
        }
      }

      const estadoAnterior = influencia.estado;
      const estadoChanged = estadoAnterior !== dto.estado;

      await influencia.update(
        {
          estado: dto.estado,
          contactoOuvId:
            dto.contacto_ouv_id === undefined
              ? influencia.contactoOuvId
              : dto.contacto_ouv_id,
          motivoEstado:
            dto.motivo_estado === undefined
              ? influencia.motivoEstado
              : dto.motivo_estado?.trim() || null,
          notas:
            dto.notas === undefined
              ? influencia.notas
              : dto.notas?.trim() || null,
          fechaUltimoCambio: estadoChanged
            ? new Date()
            : influencia.fechaUltimoCambio,
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.influencia_cambio',
        {
          estadoAnterior,
          estadoNuevo: dto.estado,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            tipo,
            estado_anterior: estadoAnterior,
            estado_nuevo: dto.estado,
            contacto_ouv_id: influencia.contactoOuvId,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);

      return influencia;
    });
  }
}
