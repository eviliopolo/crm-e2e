import type {
  IndicadoresProyecto,
  KickoffRecord,
  ValidacionRecord,
  ValidacionTipo,
  VentaGanadaRecord,
} from './types';
import { VALIDACION_TIPOS } from './types';

const ISO = (d: string) => new Date(d).toISOString();

function emptyValidaciones(
  overrides: Partial<Record<ValidacionTipo, Partial<ValidacionRecord>>> = {},
): Record<ValidacionTipo, ValidacionRecord> {
  const base: ValidacionRecord = {
    estado: 'Pendiente',
    observacion: '',
    usuario: null,
    fecha: null,
    sharepointUrl: null,
    sharepointNombre: null,
  };
  return Object.fromEntries(
    VALIDACION_TIPOS.map((t) => [t, { ...base, ...overrides[t] }]),
  ) as Record<ValidacionTipo, ValidacionRecord>;
}

function indicadoresMock(partial?: Partial<IndicadoresProyecto>): IndicadoresProyecto {
  const empty = {
    valor: null as string | null,
    estado: 'Sin dato',
    actualizadoEn: null as string | null,
    soloLectura: true,
  };
  return {
    facturacion: { ...empty, valor: '$ 2.450.000.000', estado: 'En curso', actualizadoEn: ISO('2026-08-20') },
    costos: { ...empty, valor: '72%', estado: 'Dentro de rango', actualizadoEn: ISO('2026-08-22') },
    tiempo: { ...empty, valor: 'Semana 12/48', estado: 'En plazo', actualizadoEn: ISO('2026-08-24') },
    alcance: { ...empty, valor: '85%', estado: 'Parcial', actualizadoEn: ISO('2026-08-23') },
    documentacion: { ...empty, valor: '6/9 entregables', estado: 'Pendiente', actualizadoEn: ISO('2026-08-21') },
    ejecucion: { ...empty, valor: 'En ejecución', estado: 'Activo', actualizadoEn: ISO('2026-08-25') },
    ...partial,
  };
}

const kickoffBase: KickoffRecord = {
  sesionNombre: '',
  sesionFecha: '',
  enlace: '',
  estado: 'Programado',
  fechaRealizacion: null,
  aprobaciones: [
    { id: 'comercial', label: 'Aval comercial', completada: false },
    { id: 'tecnico', label: 'Transferencia técnica', completada: false },
    { id: 'pmo', label: 'PMO confirma recepción', completada: false },
  ],
  validadoTeams: false,
  agendamientoConfirmado: false,
  agenda: null,
};

/** Fresh kickoff (no agenda) for reset / new scheduling. */
export function createEmptyKickoff(): KickoffRecord {
  return {
    ...kickoffBase,
    aprobaciones: kickoffBase.aprobaciones.map((a) => ({ ...a })),
  };
}

function spUrl(path: string): string {
  return `https://verytel.sharepoint.com/sites/preventa/Shared%20Documents/${path}`;
}

/** Demo OUVs — ganadas, listas para flujo Oferta & Cierre → Implementación (mock). */
export const DEMO_VENTAS_GANADAS: VentaGanadaRecord[] = [
  {
    ouvId: 'demo-ouv-001',
    consecutivo: 'OUV-0241-AeropuertoSanAndres',
    titulo: 'Seguridad Perimetral Aeropuerto San Andrés Islas',
    empresaNombre: 'Aerocivil — San Andrés',
    vendedorNombre: 'Carlos Méndez',
    estadoRevision: 'EnRevision',
    validaciones: emptyValidaciones({
      Tecnica: {
        estado: 'Aprobado',
        observacion: 'Arquitectura validada con Preventa.',
        usuario: 'Ana Ruiz',
        fecha: ISO('2026-08-19'),
        sharepointUrl: spUrl('OUV-0241/Diseno_Tecnico_ADZ.pdf'),
        sharepointNombre: 'Diseño técnico ADZ.pdf',
      },
      Financiera: {
        estado: 'Pendiente',
        observacion: 'Esperando confirmación FyA.',
        usuario: null,
        fecha: null,
        sharepointUrl: spUrl('OUV-0241/Modelo_Financiero_ADZ.xlsx'),
        sharepointNombre: 'Modelo financiero ADZ.xlsx',
      },
    }),
    datosBase: {
      ouvId: 'demo-ouv-001',
      consecutivo: 'OUV-0241-AeropuertoSanAndres',
      nombreProyecto: 'Seguridad Perimetral ADZ',
      cliente: 'Aerocivil — San Andrés',
      oportunidad: 'OUV-0241-AeropuertoSanAndres',
      fechaInicio: '2026-09-01',
      fechaFin: '2027-06-30',
      valorFacturar: 2450000000,
      costoEstimado: 1764000000,
      recurrente: false,
      empresasEjecutoras: ['Verytel', 'UT'],
      unionesTemporales: [
        { nombre: 'UT Perimetral Caribe', participacionPct: 60 },
        { nombre: 'Verytel S.A.', participacionPct: 40 },
      ],
      directorProyectoId: null,
      directorProyectoNombre: null,
      tipoVenta: 'Licitacion',
      centroCostos: 'CC-GOB-241',
      ubv: 'Gobierno / Infraestructura crítica',
      participacion: 'Verytel + UT Perimetral Caribe',
      participacionPct: 100,
    },
    kickoff: { ...kickoffBase },
    envioPmo: {
      estado: 'NoEnviado',
      consecutivoControlProyectos: null,
      serConsecutivo: null,
      motivo: null,
      enviadoEn: null,
    },
    indicadores: indicadoresMock(),
    csat: { valor: null, escala: 5, fecha: null },
    alertas: [],
    historialEstados: [
      { estado: 'OUV creada', fecha: ISO('2026-07-10'), origen: 'CRM' },
      { estado: 'Ganada', fecha: ISO('2026-08-15'), origen: 'CRM' },
      { estado: 'En bandeja soporte comercial', fecha: ISO('2026-08-16'), origen: 'CRM' },
    ],
    createdAt: ISO('2026-07-10'),
    updatedAt: ISO('2026-08-20'),
  },
  {
    ouvId: 'demo-ouv-002',
    consecutivo: 'OUV-0245-MinDefensaBogota',
    titulo: 'Centro de Monitoreo Integrado — MinDefensa',
    empresaNombre: 'Ministerio de Defensa',
    vendedorNombre: 'Laura Vargas',
    estadoRevision: 'Aprobada',
    validaciones: emptyValidaciones({
      Tecnica: {
        estado: 'Aprobado',
        observacion: 'OK',
        usuario: 'Ana Ruiz',
        fecha: ISO('2026-08-11'),
        sharepointUrl: spUrl('OUV-0245/Diseno_Tecnico_CMI.pdf'),
        sharepointNombre: 'Diseño técnico CMI.pdf',
      },
      Financiera: {
        estado: 'Aprobado',
        observacion: 'Margen confirmado.',
        usuario: 'Ana Ruiz',
        fecha: ISO('2026-08-12'),
        sharepointUrl: spUrl('OUV-0245/Modelo_Financiero_CMI.xlsx'),
        sharepointNombre: 'Modelo financiero CMI.xlsx',
      },
    }),
    datosBase: {
      ouvId: 'demo-ouv-002',
      consecutivo: 'OUV-0245-MinDefensaBogota',
      nombreProyecto: 'CMI MinDefensa Bogotá',
      cliente: 'Ministerio de Defensa',
      oportunidad: 'OUV-0245-MinDefensaBogota',
      fechaInicio: '2026-10-01',
      fechaFin: '2028-03-31',
      valorFacturar: 8900000000,
      costoEstimado: 6230000000,
      recurrente: true,
      empresasEjecutoras: ['Frisson', 'Verytel'],
      unionesTemporales: [
        { nombre: 'Frisson S.A.S.', participacionPct: 55 },
        { nombre: 'Verytel S.A.', participacionPct: 45 },
      ],
      directorProyectoId: 'dp-001',
      directorProyectoNombre: 'Diego Herrera',
      tipoVenta: 'VentaDirecta',
      centroCostos: 'CC-DYS-245',
      ubv: 'Defensa y Seguridad',
      participacion: 'Frisson + Verytel',
      participacionPct: 100,
    },
    kickoff: {
      sesionNombre: 'Kickoff CMI MinDefensa',
      sesionFecha: '2026-08-22',
      enlace: 'https://teams.microsoft.com/mock/kickoff-cmi',
      estado: 'Realizado',
      fechaRealizacion: ISO('2026-08-22'),
      aprobaciones: [
        { id: 'comercial', label: 'Aval comercial', completada: true },
        { id: 'tecnico', label: 'Transferencia técnica', completada: true },
        { id: 'pmo', label: 'PMO confirma recepción', completada: true },
      ],
      validadoTeams: true,
      agendamientoConfirmado: true,
      agenda: {
        nombreReunion: 'Kickoff CMI MinDefensa',
        invitados: [
          {
            id: 'int-laura',
            email: 'laura.vargas@verytel.com',
            nombre: 'Laura Vargas',
            tipo: 'Interno',
          },
          {
            id: 'int-diego',
            email: 'diego.herrera@verytel.com',
            nombre: 'Diego Herrera',
            tipo: 'Interno',
          },
        ],
        inicio: ISO('2026-08-22T14:30:00'),
        fin: ISO('2026-08-22T15:30:00'),
        ubicaciones: ['Teams'],
        salaVerytel: null,
        ubicacionDetalle: 'Reunión de Microsoft Teams',
        observacionesInvitados: 'Kickoff de entrega del proyecto CMI.',
        confirmadaEn: ISO('2026-08-20'),
      },
    },
    envioPmo: {
      estado: 'NoEnviado',
      consecutivoControlProyectos: null,
      serConsecutivo: null,
      motivo: null,
      enviadoEn: null,
    },
    indicadores: indicadoresMock(),
    csat: { valor: null, escala: 5, fecha: null },
    alertas: [],
    historialEstados: [
      { estado: 'OUV creada', fecha: ISO('2026-06-01'), origen: 'CRM' },
      { estado: 'Ganada', fecha: ISO('2026-08-05'), origen: 'CRM' },
      { estado: 'Validaciones aprobadas', fecha: ISO('2026-08-12'), origen: 'CRM' },
      { estado: 'Kickoff realizado', fecha: ISO('2026-08-22'), origen: 'CRM' },
    ],
    createdAt: ISO('2026-06-01'),
    updatedAt: ISO('2026-08-22'),
  },
  {
    ouvId: 'demo-ouv-003',
    consecutivo: 'OUV-0238-AlcaldiaMedellin',
    titulo: 'Videovigilancia Ciudad Inteligente — Medellín',
    empresaNombre: 'Alcaldía de Medellín',
    vendedorNombre: 'Carlos Méndez',
    estadoRevision: 'Aprobada',
    validaciones: emptyValidaciones({
      Tecnica: {
        estado: 'Aprobado',
        observacion: 'OK',
        usuario: 'Ana Ruiz',
        fecha: ISO('2026-07-28'),
        sharepointUrl: spUrl('OUV-0238/Diseno_Tecnico_SmartCities.pdf'),
        sharepointNombre: 'Diseño técnico Smart Cities.pdf',
      },
      Financiera: {
        estado: 'Aprobado',
        observacion: 'OK',
        usuario: 'Ana Ruiz',
        fecha: ISO('2026-07-29'),
        sharepointUrl: spUrl('OUV-0238/Modelo_Financiero_SmartCities.xlsx'),
        sharepointNombre: 'Modelo financiero Smart Cities.xlsx',
      },
    }),
    datosBase: {
      ouvId: 'demo-ouv-003',
      consecutivo: 'OUV-0238-AlcaldiaMedellin',
      nombreProyecto: 'Smart Cities Medellín Fase II',
      cliente: 'Alcaldía de Medellín',
      oportunidad: 'OUV-0238-AlcaldiaMedellin',
      fechaInicio: '2026-05-15',
      fechaFin: '2027-12-31',
      valorFacturar: 5200000000,
      costoEstimado: 3640000000,
      recurrente: false,
      empresasEjecutoras: ['Verytel'],
      unionesTemporales: [{ nombre: 'Verytel S.A.', participacionPct: 100 }],
      directorProyectoId: 'dp-002',
      directorProyectoNombre: 'María Soto',
      tipoVenta: 'Licitacion',
      centroCostos: 'CC-GOB-238',
      ubv: 'Gobierno / Smart Cities',
      participacion: 'Verytel S.A.',
      participacionPct: 100,
    },
    kickoff: {
      sesionNombre: 'Kickoff Smart Cities MDE',
      sesionFecha: '2026-08-01',
      enlace: 'https://teams.microsoft.com/mock/kickoff-mde',
      estado: 'Realizado',
      fechaRealizacion: ISO('2026-08-01'),
      aprobaciones: [
        { id: 'comercial', label: 'Aval comercial', completada: true },
        { id: 'tecnico', label: 'Transferencia técnica', completada: true },
        { id: 'pmo', label: 'PMO confirma recepción', completada: true },
      ],
      validadoTeams: true,
      agendamientoConfirmado: true,
      agenda: {
        nombreReunion: 'Kickoff Smart Cities MDE',
        invitados: [
          {
            id: 'int-maria',
            email: 'maria.soto@verytel.com',
            nombre: 'María Soto',
            tipo: 'Interno',
          },
        ],
        inicio: ISO('2026-08-01T10:00:00'),
        fin: ISO('2026-08-01T11:00:00'),
        ubicaciones: ['Presencial'],
        salaVerytel: 'Sala Marte',
        ubicacionDetalle: 'Oficinas Verytel — Sala Marte',
        observacionesInvitados: '',
        confirmadaEn: ISO('2026-07-28'),
      },
    },
    envioPmo: {
      estado: 'Enviado',
      consecutivoControlProyectos: 'CP-2026-00487',
      serConsecutivo: 'SER-0210-AlcaldiaMedellin',
      motivo: null,
      enviadoEn: ISO('2026-08-05'),
    },
    indicadores: indicadoresMock({
      facturacion: { valor: '$ 1.820.000.000', estado: 'Facturado parcial', actualizadoEn: ISO('2026-08-24'), soloLectura: true },
      costos: { valor: '68%', estado: 'Dentro de rango', actualizadoEn: ISO('2026-08-24'), soloLectura: true },
    }),
    csat: { valor: 4.2, escala: 5, fecha: ISO('2026-08-20') },
    alertas: [
      {
        id: 'cp-a1',
        tipo: 'Retraso documentación',
        estado: 'Activa',
        descripcion: 'Control de Proyectos reporta 3 entregables pendientes de acta.',
        fecha: ISO('2026-08-23'),
      },
    ],
    historialEstados: [
      { estado: 'OUV creada', fecha: ISO('2026-05-01'), origen: 'CRM' },
      { estado: 'Ganada', fecha: ISO('2026-07-25'), origen: 'CRM' },
      { estado: 'Enviada a PMO', fecha: ISO('2026-08-05'), origen: 'Control de Proyectos (mock)' },
      { estado: 'SER-0210 creado', fecha: ISO('2026-08-05'), origen: 'Control de Proyectos (mock)' },
    ],
    createdAt: ISO('2026-05-01'),
    updatedAt: ISO('2026-08-24'),
  },
];

export function createVentaFromOuvApi(ouv: {
  ouv_id: string;
  consecutivo: string;
  titulo: string;
  empresa_nombre: string;
  monto_final: string | null;
  moneda_final: string | null;
  created_at: string;
  updated_at: string;
}, vendedorNombre: string): VentaGanadaRecord {
  const monto = ouv.monto_final ? Number(ouv.monto_final) : 0;
  return {
    ouvId: ouv.ouv_id,
    consecutivo: ouv.consecutivo,
    titulo: ouv.titulo,
    empresaNombre: ouv.empresa_nombre,
    vendedorNombre,
    estadoRevision: 'Pendiente',
    validaciones: emptyValidaciones({
      Tecnica: {
        sharepointUrl: spUrl(`${ouv.consecutivo}/Diseno_Tecnico.pdf`),
        sharepointNombre: 'Diseño técnico.pdf',
      },
      Financiera: {
        sharepointUrl: spUrl(`${ouv.consecutivo}/Modelo_Financiero.xlsx`),
        sharepointNombre: 'Modelo financiero.xlsx',
      },
    }),
    datosBase: {
      ouvId: ouv.ouv_id,
      consecutivo: ouv.consecutivo,
      nombreProyecto: ouv.titulo,
      cliente: ouv.empresa_nombre,
      oportunidad: ouv.consecutivo,
      fechaInicio: '',
      fechaFin: '',
      valorFacturar: monto,
      costoEstimado: Math.round(monto * 0.72),
      recurrente: false,
      empresasEjecutoras: ['Verytel'],
      unionesTemporales: [{ nombre: 'Verytel S.A.', participacionPct: 100 }],
      directorProyectoId: null,
      directorProyectoNombre: null,
      tipoVenta: 'VentaDirecta',
      centroCostos: '',
      ubv: '',
      participacion: 'Verytel S.A.',
      participacionPct: 100,
    },
    kickoff: { ...kickoffBase },
    envioPmo: {
      estado: 'NoEnviado',
      consecutivoControlProyectos: null,
      serConsecutivo: null,
      motivo: null,
      enviadoEn: null,
    },
    indicadores: indicadoresMock(),
    csat: { valor: null, escala: 5, fecha: null },
    alertas: [],
    historialEstados: [
      { estado: 'Ganada', fecha: ouv.updated_at, origen: 'CRM' },
      { estado: 'En bandeja soporte comercial', fecha: new Date().toISOString(), origen: 'CRM' },
    ],
    createdAt: ouv.created_at,
    updatedAt: ouv.updated_at,
  };
}
