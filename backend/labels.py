"""Traducciones centralizadas de claves técnicas a español.
Replica del labels.ts del frontend, usado por Excel y PDFs del backend."""

ROLES = {
    "admin": "Administrador",
    "credit_advisor": "Asesor de crédito",
    "technical": "Equipo técnico",
    "site_manager": "Residente de obra",
}

USER_STATUS = {
    "pending": "Pendiente",
    "approved": "Aprobado",
    "rejected": "Rechazado",
}

CLIENT_STATUS = {
    "activo": "Activo",
    "en_progreso": "En progreso",
    "completado": "Completado",
}

PAYMENT_METHOD = {
    "credito": "Crédito",
    "efectivo": "Efectivo",
}

STAGE_STATUS = {
    "pending": "Pendiente",
    "in_progress": "En progreso",
    "completed": "Completado",
}

INSTALLMENT_STATUS = {
    "pending": "Pendiente",
    "paid": "Pagada",
    "overdue": "Vencida",
}

FREQUENCY = {
    "mensual": "Mensual",
    "quincenal": "Quincenal",
    "semanal": "Semanal",
}

# Etapas fijas — Ruta de Crédito
CREDIT_STAGES = [
    "pre_calificacion",
    "documentacion",
    "solicitud_credito",
    "avaluo",
    "aprobacion",
    "desembolso",
    "acompanamiento",
]

CREDIT_STAGE_LABELS = {
    "pre_calificacion": "Pre-calificación",
    "documentacion": "Documentación",
    "solicitud_credito": "Solicitud de crédito",
    "avaluo": "Avalúo",
    "aprobacion": "Aprobación",
    "desembolso": "Desembolso",
    "acompanamiento": "Acompañamiento",
}

# Etapas fijas — Ruta Técnica
TECHNICAL_STAGES = [
    "levantamiento_topografico",
    "linea_fabrica",
    "diseno_borrador",
    "diseno_final",
    "planos_hidrosanitarios",
    "planos_electricos",
    "calculo_estructural",
    "planos_estructurales",
    "socializacion_produccion",
    "asignacion_residente",
]

TECHNICAL_STAGE_LABELS = {
    "levantamiento_topografico": "Levantamiento topográfico",
    "linea_fabrica": "Línea de fábrica",
    "diseno_borrador": "Diseño borrador",
    "diseno_final": "Diseño final",
    "planos_hidrosanitarios": "Planos hidrosanitarios",
    "planos_electricos": "Planos eléctricos",
    "calculo_estructural": "Cálculo estructural",
    "planos_estructurales": "Planos estructurales",
    "socializacion_produccion": "Socialización a producción",
    "asignacion_residente": "Asignación de residente",
}
