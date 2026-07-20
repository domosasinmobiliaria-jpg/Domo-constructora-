// Traducciones centralizadas de claves técnicas a español.
// Único lugar usado por UI y PDFs (el backend replica esto en labels.py).

export const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  credit_advisor: 'Asesor de crédito',
  technical: 'Equipo técnico',
  site_manager: 'Residente de obra',
};

export const userStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export const clientStatusLabels: Record<string, string> = {
  activo: 'Activo',
  en_progreso: 'En progreso',
  completado: 'Completado',
};

export const paymentMethodLabels: Record<string, string> = {
  credito: 'Crédito',
  efectivo: 'Efectivo',
};

export const stageStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completado',
};

export const installmentStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  overdue: 'Vencida',
};

export const installmentStatusEmoji: Record<string, string> = {
  pending: '🟠',
  paid: '🟢',
  overdue: '🔴',
};

export const frequencyLabels: Record<string, string> = {
  mensual: 'Mensual',
  quincenal: 'Quincenal',
  semanal: 'Semanal',
};

// Etapas fijas — Ruta de Crédito (en orden).
export const creditStages: string[] = [
  'pre_calificacion',
  'documentacion',
  'solicitud_credito',
  'avaluo',
  'aprobacion',
  'desembolso',
  'acompanamiento',
];

export const creditStageLabels: Record<string, string> = {
  pre_calificacion: 'Pre-calificación',
  documentacion: 'Documentación',
  solicitud_credito: 'Solicitud de crédito',
  avaluo: 'Avalúo',
  aprobacion: 'Aprobación',
  desembolso: 'Desembolso',
  acompanamiento: 'Acompañamiento',
};

// Etapas fijas — Ruta Técnica (en orden).
export const technicalStages: string[] = [
  'levantamiento_topografico',
  'linea_fabrica',
  'diseno_borrador',
  'diseno_final',
  'planos_hidrosanitarios',
  'planos_electricos',
  'calculo_estructural',
  'planos_estructurales',
  'socializacion_produccion',
  'asignacion_residente',
];

export const technicalStageLabels: Record<string, string> = {
  levantamiento_topografico: 'Levantamiento topográfico',
  linea_fabrica: 'Línea de fábrica',
  diseno_borrador: 'Diseño borrador',
  diseno_final: 'Diseño final',
  planos_hidrosanitarios: 'Planos hidrosanitarios',
  planos_electricos: 'Planos eléctricos',
  calculo_estructural: 'Cálculo estructural',
  planos_estructurales: 'Planos estructurales',
  socializacion_produccion: 'Socialización a producción',
  asignacion_residente: 'Asignación de residente',
};

// ¿Puede el rol escribir en el proceso? (espejo del RBAC del backend).
export function canWrite(role: string | undefined, area: 'credit' | 'technical' | 'construction' | 'payments'): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (area === 'credit' || area === 'payments') return role === 'credit_advisor';
  if (area === 'technical') return role === 'technical';
  if (area === 'construction') return role === 'site_manager';
  return false;
}
