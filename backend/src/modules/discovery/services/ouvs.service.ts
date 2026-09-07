import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Sequelize, type Transaction } from 'sequelize';
import { AccountsService } from '../../accounts/services/accounts.service';
import { UsersService } from '../../auth/services/users.service';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { StatusHistoryService } from '../../workflow-engine/services/status-history.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import type { ActualizarOuvDto } from '../dtos/actualizar-ouv.dto';
import type { ActualizarPresupuestoDto } from '../dtos/actualizar-presupuesto.dto';
import type {
  DescartarOuvDto,
  GanarOuvDto,
  PerderOuvDto,
} from '../dtos/cierre-ouv.dto';
import type { CrearOuvDirectaDto } from '../dtos/crear-ouv-directa.dto';
import type { CrearOuvDto } from '../dtos/crear-ouv.dto';
import type { ListarOuvsQueryDto } from '../dtos/listar-ouvs-query.dto';
import type { OuvResponseDto } from '../dtos/ouv-response.dto';
import { canMutateOuvEnCurso } from '../lib/ouv-access';
import {
  computeOuvZonaDays,
  parseZonaValue,
  type OuvDiasPorZona,
} from '../lib/ouv-zona-days';
import { nextZona, prevZona } from '../lib/ouv-zona-order';
import {
  OuvOrigenVia,
  OuvResultado,
  OuvZona,
} from '../models/enums/ouv.enums';
import { MotivoDescarte } from '../models/motivo-descarte.model';
import { MotivoPerdida } from '../models/motivo-perdida.model';
import { Ouv } from '../models/ouv.model';
import { CriteriosZonaEvaluator } from './criterios-zona.evaluator';
import { OuvChecklistService } from './ouv-checklist.service';
import { OuvContactosService } from './ouv-contactos.service';
import { OuvInfluenciasService } from './ouv-influencias.service';

export type CrearDesdeSqlInput = {
  sqlId: string;
  comercialId: string;
  leadId: string;
  dto: CrearOuvDto;
};

export type PaginatedOuvs = {
  items: Ouv[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class OuvsService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(MotivoPerdida)
    private readonly motivoPerdidaModel: typeof MotivoPerdida,
    @InjectModel(MotivoDescarte)
    private readonly motivoDescarteModel: typeof MotivoDescarte,
    private readonly demandGeneration: DemandGenerationService,
    private readonly accountsService: AccountsService,
    private readonly usersService: UsersService,
    private readonly contactosService: OuvContactosService,
    private readonly influenciasService: OuvInfluenciasService,
    private readonly checklistService: OuvChecklistService,
    private readonly criteriosEvaluator: CriteriosZonaEvaluator,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly statusHistoryService: StatusHistoryService,
  ) {}

  /**
   * Vía 1 — create OUV from SQL inside caller's transaction (EARS-01..03).
   * Workflow event `ouv.creada_desde_sql` is emitted by SqlsService (qualification).
   */
  async crearDesdeSql(
    input: CrearDesdeSqlInput,
    transaction: Transaction,
  ): Promise<Ouv> {
    const lead = await this.demandGeneration.findLeadById(input.leadId);
    const primary =
      lead.contacts?.find((c) => c.position === 1) ?? lead.contacts?.[0];
    if (!primary?.person_id) {
      throw new BadRequestException(
        'Lead must have a primary contact (position=1) with person_id to create OUV from SQL',
      );
    }

    const people = await this.accountsService.getPeopleWithAccounts([
      primary.person_id,
    ]);
    const person = people.get(primary.person_id);
    if (!person?.account_id || !person.account_name?.trim()) {
      throw new BadRequestException(
        'Cannot resolve accounts.name for the lead primary contact (GC-13 / EARS-01)',
      );
    }

    await this.demandGeneration.assertSegmentSubsegment(
      input.dto.segment_id,
      input.dto.subsegment_id,
    );

    const consecutivo = await this.nextOuvConsecutivo(transaction);

    const ouv = await this.ouvModel.create(
      {
        consecutivo,
        sqlIdOrigen: input.sqlId,
        origenVia: OuvOrigenVia.DesdeSql,
        comercialId: input.comercialId,
        accountId: person.account_id,
        titulo: input.dto.titulo.trim(),
        empresaNombre: person.account_name.trim(),
        descripcion: input.dto.descripcion?.trim() || null,
        segmento: input.dto.segmento,
        segmentId: input.dto.segment_id,
        subsegmentId: input.dto.subsegment_id ?? null,
        vertical: input.dto.vertical,
        zonaActual: OuvZona.Universo,
        resultado: OuvResultado.EnCurso,
        tieneGap: false,
        presupuestoConfirmado: false,
      },
      { transaction },
    );

    const ouvId = String(ouv.getDataValue('ouvId') ?? ouv.ouvId ?? '').trim();
    if (!ouvId) {
      throw new BadRequestException(
        'OUV was created without ouv_id; cannot attach contacts (EARS-02)',
      );
    }

    const personIds = (lead.contacts ?? [])
      .map((c) => c.person_id)
      .filter((id): id is string => Boolean(id?.trim()));

    await this.contactosService.reutilizarDesdeLead(
      ouvId,
      input.leadId,
      transaction,
      personIds,
    );
    await this.influenciasService.seedInfluenciasParaOuv(ouvId, transaction);
    await this.checklistService.seedChecklistParaZona(
      ouvId,
      OuvZona.Universo,
      transaction,
    );

    return ouv;
  }

  /** Vías 2/3/4 — direct OUV (EARS-05..07). */
  async crearDirecta(
    dto: CrearOuvDirectaDto,
    actorUserId: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const consecutivo = await this.nextOuvConsecutivo(transaction);

      let accountId: string | null = dto.account_id?.trim() || null;
      let empresaNombre = dto.empresa_nombre.trim();
      if (accountId) {
        const account = await this.accountsService.getAccount(accountId);
        // Spec §2.1: MAY align snapshot to accounts.name when account chosen.
        empresaNombre = account.name.trim() || empresaNombre;
      }

      const ouv = await this.ouvModel.create(
        {
          consecutivo,
          sqlIdOrigen: null,
          origenVia: OuvOrigenVia.Directa,
          comercialId: actorUserId,
          accountId,
          titulo: dto.titulo.trim(),
          empresaNombre,
          descripcion: dto.descripcion.trim(),
          segmento: dto.segmento,
          segmentId: dto.segment_id ?? null,
          subsegmentId: dto.subsegment_id ?? null,
          vertical: dto.vertical,
          zonaActual: OuvZona.Universo,
          resultado: OuvResultado.EnCurso,
          tieneGap: false,
          presupuestoConfirmado: false,
        },
        { transaction },
      );

      await this.influenciasService.seedInfluenciasParaOuv(
        ouv.ouvId,
        transaction,
      );
      await this.checklistService.seedChecklistParaZona(
        ouv.ouvId,
        OuvZona.Universo,
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.creada_directa',
        {
          estadoAnterior: null,
          estadoNuevo: OuvZona.Universo,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: actorUserId,
            titulo: ouv.titulo,
            empresa_nombre: ouv.empresaNombre,
            account_id: ouv.accountId,
          },
          entity: { estado: OuvZona.Universo },
        },
        transaction,
      );

      return ouv;
    });
  }

  async avanzarZona(
    ouvId: string,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );
      const destino = nextZona(ouv.zonaActual);
      if (!destino) {
        throw new BadRequestException(
          `Cannot advance from zona ${ouv.zonaActual}`,
        );
      }

      await this.assertGuardsForDestino(ouv, destino, transaction);

      const estadoAnterior = ouv.zonaActual;
      const verdes = await this.influenciasService.countVerde(
        ouv.ouvId,
        transaction,
      );

      await ouv.update({ zonaActual: destino }, { transaction });
      await this.checklistService.seedChecklistParaZona(
        ouv.ouvId,
        destino,
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.avance_zona',
        {
          estadoAnterior,
          estadoNuevo: destino,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            zona_anterior: estadoAnterior,
            zona_nueva: destino,
            comercial_id: ouv.comercialId,
            presupuesto_confirmado: ouv.presupuestoConfirmado,
            influencias_verde_count: verdes,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);
      return ouv;
    });
  }

  async retrocederZona(
    ouvId: string,
    motivo: string,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    const motivoTrim = motivo?.trim();
    if (!motivoTrim) {
      throw new BadRequestException('motivo is required to retroceder');
    }

    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );
      const destino = prevZona(ouv.zonaActual);
      if (!destino) {
        throw new BadRequestException(
          'Cannot retroceder from UNIVERSO — use Descartada instead',
        );
      }

      const estadoAnterior = ouv.zonaActual;
      await ouv.update({ zonaActual: destino }, { transaction });

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.retroceso_zona',
        {
          estadoAnterior,
          estadoNuevo: destino,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            motivo: motivoTrim,
            zona_anterior: estadoAnterior,
            zona_nueva: destino,
            comercial_id: ouv.comercialId,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);
      return ouv;
    });
  }

  async ganar(
    ouvId: string,
    dto: GanarOuvDto,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );

      if (ouv.zonaActual !== OuvZona.MayorProbabilidad) {
        throw new BadRequestException(
          `Ganada requires zona MAYOR_PROBABILIDAD (current: ${ouv.zonaActual})`,
        );
      }

      let motivoSnapshot: string | null = null;
      if (dto.motivo_id) {
        const motivo = await this.motivoPerdidaModel.findByPk(dto.motivo_id, {
          transaction,
        });
        if (!motivo) {
          throw new BadRequestException(`motivo_id ${dto.motivo_id} not found`);
        }
        motivoSnapshot = motivo.nombre;
        if (motivo.requiereDetalle && !dto.motivo_detalle?.trim()) {
          throw new BadRequestException(
            'motivo_detalle is required for this motivo',
          );
        }
      }

      const zonaAlCerrar = ouv.zonaActual;
      const estadoAnteriorResultado = ouv.resultado;
      await ouv.update(
        {
          resultado: OuvResultado.Ganada,
          motivoId: dto.motivo_id ?? null,
          motivoSnapshot,
          motivoDetalle: dto.motivo_detalle?.trim() || null,
          montoFinal: String(dto.monto_final),
          monedaFinal: dto.moneda_final,
          fechaCierre: new Date(),
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.ganada',
        {
          estadoAnterior: zonaAlCerrar,
          estadoNuevo: OuvResultado.Ganada,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            monto_final: dto.monto_final,
            moneda_final: dto.moneda_final,
            resultado_anterior: estadoAnteriorResultado,
          },
          entity: { estado: zonaAlCerrar },
        },
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.lista_para_implementacion',
        {
          estadoAnterior: OuvResultado.Ganada,
          estadoNuevo: OuvResultado.Ganada,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            ouv_id: ouv.ouvId,
          },
          entity: { estado: OuvResultado.Ganada },
        },
        transaction,
      );

      return ouv;
    });
  }

  async perder(
    ouvId: string,
    dto: PerderOuvDto,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );

      const motivo = await this.motivoPerdidaModel.findByPk(dto.motivo_id, {
        transaction,
      });
      if (!motivo) {
        throw new BadRequestException(`motivo_id ${dto.motivo_id} not found`);
      }
      if (motivo.requiereDetalle && !dto.motivo_detalle?.trim()) {
        throw new BadRequestException(
          'motivo_detalle is required for this motivo',
        );
      }

      const needsCompetidor = /competidor/i.test(motivo.nombre);
      if (needsCompetidor && !dto.competidor_ganador?.trim()) {
        throw new BadRequestException(
          'competidor_ganador is required for this motivo',
        );
      }

      const estadoAnterior = ouv.resultado;
      await ouv.update(
        {
          resultado: OuvResultado.Perdida,
          motivoId: motivo.motivoId,
          motivoSnapshot: motivo.nombre,
          motivoDetalle: dto.motivo_detalle?.trim() || null,
          montoEstimadoPerdido: String(dto.monto_estimado_perdido),
          competidorGanador: dto.competidor_ganador?.trim() || null,
          fechaCierre: new Date(),
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.perdida',
        {
          estadoAnterior,
          estadoNuevo: OuvResultado.Perdida,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            motivo_id: motivo.motivoId,
            motivo_snapshot: motivo.nombre,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      return ouv;
    });
  }

  async descartar(
    ouvId: string,
    dto: DescartarOuvDto,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );

      const motivo = await this.motivoDescarteModel.findByPk(dto.motivo_id, {
        transaction,
      });
      if (!motivo) {
        throw new BadRequestException(`motivo_id ${dto.motivo_id} not found`);
      }
      if (motivo.requiereDetalle && !dto.motivo_detalle?.trim()) {
        throw new BadRequestException(
          'motivo_detalle is required for this motivo',
        );
      }

      const estadoAnterior = ouv.resultado;
      await ouv.update(
        {
          resultado: OuvResultado.Descartada,
          motivoId: motivo.motivoId,
          motivoSnapshot: motivo.nombre,
          motivoDetalle: dto.motivo_detalle?.trim() || null,
          fechaCierre: new Date(),
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.descartada',
        {
          estadoAnterior,
          estadoNuevo: OuvResultado.Descartada,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            motivo_id: motivo.motivoId,
            motivo_snapshot: motivo.nombre,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      return ouv;
    });
  }

  /**
   * PATCH /discovery/ouvs/:id — metadatos y relaciones de cabecera.
   *
   * Cubre título, empresa, segmento/vertical, descripción, account_id,
   * segment_id/subsegment_id y comercial_id. Los cambios de zona, resultado
   * y presupuesto NO viajan por aquí — cada uno tiene su propio endpoint
   * con guardas de workflow y auditoría distintas.
   *
   * La reasignación de `comercial_id` la restringimos a Admin: es un cambio
   * de dueño con impacto en visibilidad y RBAC.
   */
  async actualizarMetadatos(
    ouvId: string,
    dto: ActualizarOuvDto,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );

      const patch: Partial<Ouv> = {};

      if (dto.titulo !== undefined) {
        const titulo = dto.titulo.trim();
        if (!titulo) {
          throw new BadRequestException('titulo cannot be empty');
        }
        patch.titulo = titulo;
      }
      if (dto.empresa_nombre !== undefined) {
        const empresa = dto.empresa_nombre.trim();
        if (!empresa) {
          throw new BadRequestException('empresa_nombre cannot be empty');
        }
        patch.empresaNombre = empresa;
      }
      if (dto.segmento !== undefined) patch.segmento = dto.segmento;
      if (dto.vertical !== undefined) patch.vertical = dto.vertical;
      if (dto.descripcion !== undefined) {
        patch.descripcion = dto.descripcion.trim() || null;
      }

      // Vincular / desvincular la account. Si vincula, alinea empresa_nombre
      // al snapshot de accounts.name — a menos que el DTO ya haya mandado
      // empresa_nombre explícito en el mismo PATCH.
      if (dto.account_id !== undefined) {
        if (dto.account_id === null) {
          patch.accountId = null;
        } else {
          const account = await this.accountsService.getAccount(dto.account_id);
          patch.accountId = account.account_id;
          if (dto.empresa_nombre === undefined && account.name?.trim()) {
            patch.empresaNombre = account.name.trim();
          }
        }
      }

      // Segmento estructurado. Validamos el par contra los valores actuales:
      // si solo mandan uno, el otro se resuelve desde la fila (o queda null).
      if (dto.segment_id !== undefined || dto.subsegment_id !== undefined) {
        const nextSegmentId =
          dto.segment_id !== undefined ? dto.segment_id : ouv.segmentId;
        const nextSubsegmentId =
          dto.subsegment_id !== undefined
            ? dto.subsegment_id
            : ouv.subsegmentId;

        if (nextSegmentId) {
          await this.demandGeneration.assertSegmentSubsegment(
            nextSegmentId,
            nextSubsegmentId ?? undefined,
          );
        } else if (nextSubsegmentId) {
          throw new BadRequestException(
            'subsegment_id requires a non-null segment_id',
          );
        }

        if (dto.segment_id !== undefined) patch.segmentId = dto.segment_id;
        if (dto.subsegment_id !== undefined) {
          patch.subsegmentId = dto.subsegment_id;
        }
      }

      // Reasignar comercial dueño: solo Admin.
      if (dto.comercial_id !== undefined) {
        if (roleName !== 'Admin') {
          throw new ForbiddenException(
            'Only Admin can reassign the OUV commercial owner',
          );
        }
        const eligible = await this.usersService.isActiveWithRole(
          dto.comercial_id,
          'EjecutivoComercial',
        );
        if (!eligible) {
          throw new BadRequestException(
            'comercial_id must reference an active Ejecutivo Comercial',
          );
        }
        patch.comercialId = dto.comercial_id;
      }

      if (Object.keys(patch).length === 0) {
        throw new BadRequestException('No fields to update');
      }

      await ouv.update(patch, { transaction });
      return ouv;
    });
  }

  async actualizarPresupuesto(
    ouvId: string,
    dto: ActualizarPresupuestoDto,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(
        ouvId,
        actorUserId,
        roleName,
        transaction,
      );

      await ouv.update(
        {
          presupuestoConfirmado: dto.presupuesto_confirmado,
          presupuestoMonto:
            dto.presupuesto_monto === undefined ||
            dto.presupuesto_monto === null
              ? null
              : String(dto.presupuesto_monto),
          presupuestoMoneda: dto.presupuesto_moneda ?? null,
          presupuestoFechaCaptura: dto.presupuesto_fecha_captura
            ? new Date(dto.presupuesto_fecha_captura)
            : null,
          presupuestoFuente: dto.presupuesto_fuente ?? null,
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.presupuesto_actualizado',
        {
          estadoAnterior: ouv.zonaActual,
          estadoNuevo: ouv.zonaActual,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            presupuesto_confirmado: dto.presupuesto_confirmado,
            comercial_id: ouv.comercialId,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);
      return ouv;
    });
  }

  async listarPorComercial(
    comercialId: string,
    query: ListarOuvsQueryDto,
  ): Promise<PaginatedOuvs> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string | symbol, unknown> = {};

    if (!query.all) {
      where.comercialId = comercialId;
    }
    if (query.zona) {
      where.zonaActual = query.zona;
    }
    if (query.resultado) {
      where.resultado = query.resultado;
    }
    if (query.tiene_gap !== undefined) {
      where.tieneGap = query.tiene_gap;
    }
    if (query.q?.trim()) {
      const like = `%${query.q.trim()}%`;
      where[Op.or] = [
        { titulo: { [Op.like]: like } },
        { empresaNombre: { [Op.like]: like } },
        { consecutivo: { [Op.like]: like } },
      ];
    }
    if (query.created_from || query.created_to) {
      where.createdAt = {
        ...(query.created_from
          ? { [Op.gte]: new Date(query.created_from) }
          : {}),
        ...(query.created_to ? { [Op.lte]: new Date(query.created_to) } : {}),
      };
    }

    const { rows, count } = await this.ouvModel.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return { items: rows, total: count, page, limit };
  }

  async findById(ouvId: string): Promise<Ouv | null> {
    return this.ouvModel.findByPk(ouvId);
  }

  /**
   * Detail with ownership: Ejecutivo owns; SoporteComercial/Admin can read all.
   */
  async getDetalle(
    ouvId: string,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    const ouv = await this.ouvModel.findByPk(ouvId);
    if (!ouv) {
      throw new NotFoundException(`OUV ${ouvId} not found`);
    }
    const canReadAll =
      roleName === 'SoporteComercial' || roleName === 'Admin';
    if (!canReadAll && ouv.comercialId !== actorUserId) {
      throw new ForbiddenException('Not allowed to view this OUV');
    }
    return ouv;
  }

  toResponse(ouv: Ouv, diasPorZona?: OuvDiasPorZona): OuvResponseDto {
    return {
      ouv_id: ouv.ouvId,
      consecutivo: ouv.consecutivo,
      sql_id_origen: ouv.sqlIdOrigen,
      origen_via: ouv.origenVia,
      comercial_id: ouv.comercialId,
      account_id: ouv.accountId ?? null,
      titulo: ouv.titulo,
      empresa_nombre: ouv.empresaNombre,
      descripcion: ouv.descripcion,
      segmento: ouv.segmento,
      segment_id: ouv.segmentId ?? null,
      subsegment_id: ouv.subsegmentId ?? null,
      vertical: ouv.vertical,
      zona_actual: ouv.zonaActual,
      resultado: ouv.resultado,
      tiene_gap: ouv.tieneGap,
      criterios_faltantes: ouv.criteriosFaltantes,
      presupuesto_confirmado: ouv.presupuestoConfirmado,
      presupuesto_monto: ouv.presupuestoMonto,
      presupuesto_moneda: ouv.presupuestoMoneda,
      presupuesto_fecha_captura: ouv.presupuestoFechaCaptura,
      presupuesto_fuente: ouv.presupuestoFuente,
      motivo_id: ouv.motivoId,
      motivo_snapshot: ouv.motivoSnapshot,
      motivo_detalle: ouv.motivoDetalle,
      competidor_ganador: ouv.competidorGanador,
      monto_final: ouv.montoFinal,
      moneda_final: ouv.monedaFinal,
      monto_estimado_perdido: ouv.montoEstimadoPerdido,
      fecha_cierre: ouv.fechaCierre,
      created_at: ouv.createdAt,
      updated_at: ouv.updatedAt,
      ...(diasPorZona ? { dias_por_zona: diasPorZona } : {}),
    };
  }

  async toDetailResponse(ouv: Ouv): Promise<OuvResponseDto> {
    return this.toResponse(ouv, await this.computeDiasPorZona(ouv));
  }

  private async computeDiasPorZona(ouv: Ouv): Promise<OuvDiasPorZona> {
    const history = await this.statusHistoryService.findByEntity(
      EntityType.OUV,
      ouv.ouvId,
    );
    const closeEstados = new Set(['Ganada', 'Perdida', 'Descartada']);
    const transitions = history.flatMap((row) => {
      const to = parseZonaValue(row.toEstado);
      if (!to) return [];
      return [{ at: row.changedAt, to }];
    });
    const closeRow = [...history]
      .reverse()
      .find((row) => closeEstados.has(row.toEstado));
    return computeOuvZonaDays({
      createdAt: ouv.createdAt,
      zonaActual: ouv.zonaActual,
      resultado: ouv.resultado,
      fechaCierre: ouv.fechaCierre ?? closeRow?.changedAt ?? null,
      now: new Date(),
      transitions,
    });
  }

  private async lockOwnedEnCurso(
    ouvId: string,
    actorUserId: string,
    roleName: string,
    transaction: Transaction,
  ): Promise<Ouv> {
    const ouv = await this.ouvModel.findByPk(ouvId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!ouv) {
      throw new NotFoundException(`OUV ${ouvId} not found`);
    }
    if (!canMutateOuvEnCurso(ouv.comercialId, actorUserId, roleName)) {
      throw new ForbiddenException(
        'Only the owning Ejecutivo Comercial or Admin can perform this action',
      );
    }
    if (ouv.resultado !== OuvResultado.EnCurso) {
      throw new BadRequestException(
        `OUV is already closed (resultado=${ouv.resultado})`,
      );
    }
    return ouv;
  }

  private async assertGuardsForDestino(
    ouv: Ouv,
    destino: OuvZona,
    transaction: Transaction,
  ): Promise<void> {
    if (destino === OuvZona.EncimaFunnel && !ouv.presupuestoConfirmado) {
      throw new BadRequestException(
        'presupuesto_confirmado is required to advance to ENCIMA_FUNNEL',
      );
    }

    if (
      destino === OuvZona.EnFunnel ||
      destino === OuvZona.MayorProbabilidad
    ) {
      const verdes = await this.influenciasService.countVerde(
        ouv.ouvId,
        transaction,
      );
      if (verdes < 2) {
        throw new BadRequestException(
          'At least 2 influencias in Verde with an assigned contact are required to advance',
        );
      }
    }
  }

  /**
   * Temporary MAX+FOR UPDATE sequence (Wave 1).
   * TODO: migrate to secuenciadores when Modules 3–5 land.
   */
  private async nextOuvConsecutivo(transaction: Transaction): Promise<string> {
    const rows = await this.sequelize.query<{ siguiente: number }>(
      `
        SELECT COALESCE(MAX(CAST(SUBSTRING(consecutivo, 5) AS UNSIGNED)), 0) + 1
          AS siguiente
        FROM ouvs
        FOR UPDATE
      `,
      { transaction, type: QueryTypes.SELECT },
    );
    const siguiente = Number(rows[0]?.siguiente ?? 1);
    return `OUV-${String(siguiente).padStart(4, '0')}`;
  }
}
