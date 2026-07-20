// Paleta corporativa DOMO Constructora.
export const colors = {
  primary: '#1A3A6B', // Azul principal — headers, elementos primarios
  secondary: '#F57C00', // Naranja — acciones principales, FAB
  green: '#4CAF50', // Pagado, completado
  red: '#D32F2F', // Vencido, error, eliminar
  warning: '#FF9800', // Pendiente, en progreso

  // Neutros / superficie
  background: '#F4F6F9',
  surface: '#FFFFFF',
  text: '#1C2430',
  textMuted: '#607089',
  border: '#E2E8F0',
  white: '#FFFFFF',
};

// Colores por estado de etapa/actividad.
export const stageStatusColor: Record<string, string> = {
  pending: colors.warning,
  in_progress: colors.secondary,
  completed: colors.green,
};

// Colores por estado de cuota.
export const installmentStatusColor: Record<string, string> = {
  pending: colors.warning,
  paid: colors.green,
  overdue: colors.red,
};

export default colors;
