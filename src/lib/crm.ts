export const CRM_PIPELINE_STATUSES = [
  { value: 'detectada', label: 'Detectada' },
  { value: 'preparando_documentacion', label: 'Preparando documentación' },
  { value: 'presentada', label: 'Presentada' },
  { value: 'requerimiento', label: 'Requerimiento' },
  { value: 'subsanado', label: 'Subsanado' },
  { value: 'concedida', label: 'Concedida' },
  { value: 'denegada', label: 'Denegada' },
  { value: 'justificacion', label: 'Justificación' },
  { value: 'terminada', label: 'Terminada' },
] as const;

const CRM_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CRM_PIPELINE_STATUSES.map((status) => [status.value, status.label]),
);

export const getCrmStatusLabel = (value: string) => CRM_STATUS_LABELS[value] || value;

export const getCrmStatusBadgeClass = (value: string) => {
  switch (value) {
    case 'detectada':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'preparando_documentacion':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'presentada':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'requerimiento':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'subsanado':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'concedida':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'denegada':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'justificacion':
      return 'bg-violet-100 text-violet-700 border-violet-200';
    case 'terminada':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export const formatCompactFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};
