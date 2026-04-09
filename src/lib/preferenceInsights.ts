export interface SwipeDecision {
  id: string;
  title: string;
  action: 'interesa' | 'no interesa';
  beneficiario?: string;
  lugar?: string;
  finalidad?: string;
}

export interface FrequencyEntry {
  value: string;
  count: number;
}

export interface PreferenceAggregation {
  beneficiarios: FrequencyEntry[];
  regiones: FrequencyEntry[];
  finalidades: FrequencyEntry[];
  totalLikes: number;
}

function countFrequencies(values: string[]): FrequencyEntry[] {
  const counts = new Map<string, number>();

  for (const raw of values) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    // Mantener el casing original de la primera aparición
    if (!counts.has(key)) {
      counts.set(key, 0);
    }
    counts.set(key, counts.get(key)! + 1);
  }

  // Reconstruir con casing original
  const casing = new Map<string, string>();
  for (const raw of values) {
    const key = raw.trim().toLowerCase();
    if (key && !casing.has(key)) {
      casing.set(key, raw.trim());
    }
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ value: casing.get(key) || key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export interface HistoricalInsights {
  beneficiarios: string[];
  regiones: string[];
  finalidades: string[];
  totalLikes: number;
}

export function aggregatePreferences(
  decisions: SwipeDecision[],
  historical?: HistoricalInsights | null,
): PreferenceAggregation {
  // Start from historical data if available
  const beneficiarioValues: string[] = historical?.beneficiarios?.slice() ?? [];
  const regionValues: string[] = historical?.regiones?.slice() ?? [];
  const finalidadValues: string[] = historical?.finalidades?.slice() ?? [];
  let baseLikes = historical?.totalLikes ?? 0;

  // Layer on current-session decisions
  const likes = decisions.filter(d => d.action === 'interesa');
  for (const d of likes) {
    if (d.beneficiario) {
      const parts = d.beneficiario.split(',').map(s => s.trim()).filter(Boolean);
      beneficiarioValues.push(...parts);
    }
    if (d.lugar) {
      regionValues.push(d.lugar.trim());
    }
    if (d.finalidad) {
      finalidadValues.push(d.finalidad.trim());
    }
  }

  return {
    beneficiarios: countFrequencies(beneficiarioValues),
    regiones: countFrequencies(regionValues),
    finalidades: countFrequencies(finalidadValues),
    totalLikes: baseLikes + likes.length,
  };
}

export function generateSummaryText(agg: PreferenceAggregation): string | null {
  if (agg.totalLikes < 3) return null;

  const parts: string[] = [];

  if (agg.beneficiarios.length > 0) {
    parts.push(`para **${agg.beneficiarios[0].value}**`);
  }
  if (agg.regiones.length > 0) {
    parts.push(`en **${agg.regiones[0].value}**`);
  }
  if (agg.finalidades.length > 0) {
    parts.push(`con finalidad de **${agg.finalidades[0].value}**`);
  }

  if (parts.length === 0) return null;

  return `Te interesan subvenciones ${parts.join(', ')}`;
}
