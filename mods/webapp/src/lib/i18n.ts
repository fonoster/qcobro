const es = {
  nav: {
    dashboard: "Panel",
    portfolios: "Carteras",
    campaigns: "Campañas",
    agents: "Agentes IA",
    activities: "Gestiones",
    commitments: "Resultados",
    performance: "Rendimiento",
    signOut: "Cerrar sesión"
  },
  dashboard: {
    title: "Panel de Control",
    description: "Resumen de actividad de cobranza en tiempo real",
    kpi: {
      totalActivities: "Total gestiones",
      contactRate: "Tasa de contactabilidad",
      todayPromises: "Compromisos obtenidos hoy"
    },
    charts: {
      activityByDay: "Actividad por día",
      contactRateTrend: "Tendencia de contactabilidad"
    },
    recentActivity: "Actividad reciente",
    recentActivityDesc: "Últimas 10 gestiones de cobranza",
    noActivity: "Sin actividad reciente.",
    activityOutcomes: {
      CONTACTED: "contactó a la cuenta",
      NOT_CONTACTED: "no pudo contactar a la cuenta",
      PROMISE: "registró compromiso para",
      REJECTED: "fue rechazado por la cuenta",
      PENDING: "gestionó"
    }
  },
  portfolios: {
    title: "Carteras",
    description: "Portfolios de deudas gestionados",
    newPortfolio: "Nueva cartera",
    editPortfolio: "Editar cartera",
    columns: {
      name: "Nombre",
      clientId: "Cliente ID",
      accounts: "Cuentas",
      totalAmount: "Monto total",
      recoveredAmount: "Recuperado",
      status: "Estado"
    },
    form: {
      name: "Nombre de la cartera",
      clientId: "ID del cliente",
      accounts: "Número de cuentas",
      totalAmount: "Monto total",
      create: "Crear cartera",
      save: "Guardar cambios",
      delete: "Eliminar cartera",
      creating: "Creando…",
      saving: "Guardando…"
    }
  },
  campaigns: {
    title: "Campañas",
    description: "Campañas de cobranza activas y programadas",
    newCampaign: "Nueva campaña",
    editCampaign: "Editar campaña",
    columns: {
      name: "Nombre",
      portfolio: "Cartera",
      agent: "Agente IA",
      channel: "Canal",
      status: "Estado",
      accounts: "Cuentas",
      startDate: "Inicio",
      endDate: "Fin"
    }
  },
  activities: {
    title: "Gestiones",
    description: "Registro de actividades de cobranza",
    newActivity: "Nueva gestión",
    columns: {
      campaign: "Campaña",
      accountId: "Cuenta ID",
      agent: "Agente",
      channel: "Canal",
      outcome: "Resultado",
      date: "Fecha"
    }
  },
  commitments: {
    title: "Resultados",
    description: "Promesas de pago, renegociaciones y entregas de mensajes",
    newCommitment: "Nuevo resultado",
    markOverdue: "Marcar vencidos",
    columns: {
      account: "Cuenta",
      campaign: "Campaña",
      type: "Tipo",
      amount: "Monto",
      dueDate: "Vencimiento",
      status: "Estado"
    },
    actions: {
      fulfilled: "Cumplido",
      cancel: "Cancelar"
    }
  },
  agents: {
    title: "Agentes IA",
    description: "Agentes de cobranza y su configuración",
    newAgent: "Nuevo agente",
    editAgent: "Editar agente",
    columns: {
      name: "Nombre",
      email: "Correo",
      channel: "Canal",
      strategy: "Estrategia",
      status: "Estado",
      calls: "Llamadas",
      promises: "Compromisos",
      recovered: "Recuperado",
      successRate: "Tasa de éxito"
    }
  },
  performance: {
    title: "Rendimiento",
    description: "Analítica y tendencias de operaciones de cobranza",
    contactRateTrend: "Tendencia de contactabilidad",
    contactRateTrendDesc: "Tasa de contacto diaria",
    dailyVolume: "Volumen diario de gestiones",
    dailyVolumeDesc: "Contactos por día",
    agentPerformance: "Rendimiento de agentes",
    agentPerformanceDesc: "Recuperación y tasa de éxito por agente"
  },
  common: {
    loading: "Cargando…",
    noData: "Sin datos.",
    actions: "Acciones",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    create: "Crear",
    edit: "Editar",
    search: "Buscar…",
    all: "Todos",
    status: {
      ACTIVE: "Activo",
      CLOSED: "Cerrada",
      SCHEDULED: "Programada",
      IN_PROGRESS: "En progreso",
      COMPLETED: "Completada",
      CANCELLED: "Cancelada",
      PENDING: "Pendiente",
      FULFILLED: "Cumplido",
      OVERDUE: "Vencido",
      PAUSED: "Pausado"
    },
    strategy: {
      AGGRESSIVE: "Agresiva",
      MODERATE: "Moderada",
      GENTLE: "Suave"
    },
    channel: {
      VOICE: "Voz",
      VOICE_AI: "Voz IA",
      WHATSAPP: "WhatsApp",
      SMS: "SMS",
      EMAIL: "Correo",
      CALL: "Llamada"
    },
    commitmentType: {
      PAYMENT_PROMISE: "Promesa de pago",
      RENEGOTIATION: "Renegociación",
      MESSAGE_DELIVERY: "Entrega de mensaje"
    },
    outcome: {
      CONTACTED: "Contactado",
      NOT_CONTACTED: "No contactado",
      PROMISE: "Compromiso",
      REJECTED: "Rechazado",
      PENDING: "Pendiente"
    }
  }
} as const;

export type Locale = typeof es;
export const t = es;
