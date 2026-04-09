import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeEuro, Building, CalendarDays, ChevronDown, ChevronUp, Download, FileDown, Landmark, Loader2, MapPin, PlusCircle, Trophy } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import ProfileCard from '@/components/ProfileCard';
import ProfileEditForm from '@/components/ProfileEditForm';
import EntityCreateForm from '@/components/EntityCreateForm';
import EntityDocuments from '@/components/EntityDocuments';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProfileData {
  razon_social: string;
  nif: string;
  descripcion: string;
  sector: string;
  facturacion_anual: string;
  tipo_empresa?: string;
  direccion_social?: string;
  cnae?: string;
  centro_trabajo?: string;
  liderado_mujeres?: boolean;
  porcentaje_mujeres?: number;
  personal_linea?: number;
  fecha_constitucion?: string;
  objeto_social?: string;
  administrador_nombre?: string;
  administrador_cargo?: string;
  administrador_año?: string;
  nombre_representante?: string;
  pagina_web?: string;
  comunidad_autonoma?: string;
  comunidad_autonoma_centro_trabajo?: string;
  telefono?: string;
  correo?: string;
  personal_en_linea?: number;
  liderado_por_mujeres?: boolean;
  porcentaje_liderado_por_mujeres?: number;
  minimis?: number | null;
  concesion_minimis?: number | null;
}

interface Entity {
  id: string;
  razon_social: string;
  nif: string;
  is_selected?: boolean;
}

interface AwardedGrant {
  id?: string;
  titulo: string;
  organismo?: string;
  fecha_concesion?: string;
  importe?: number | string | null;
  region?: string;
  departamento?: string;
  instrumento?: string;
  url?: string;
  referencia?: string;
}

interface AwardedGrantResponse {
  awards: AwardedGrant[];
  total?: number;
  source?: string;
  sourceUrl?: string;
  warning?: string;
}

interface MinimisGrant {
  id?: string | number;
  titulo: string;
  convocante?: string;
  fecha_concesion?: string;
  importe?: number | string | null;
  instrumento?: string;
  reglamento?: string;
  beneficiario?: string;
  referencia?: string;
  codigo_concesion?: string;
  numero_convocatoria?: string;
}

interface MinimisGrantResponse {
  awards: MinimisGrant[];
  total?: number;
  totalLast3YearsAmount?: number;
  totalAmount?: number;
  countLast3Years?: number;
  cutoffDate?: string;
  source?: string;
  sourceUrl?: string;
  warning?: string;
}

interface GrantAmountRecord {
  year: number;
  title: string;
  amount: number;
  category: 'minimis' | 'non_minimis';
}

interface GrantAmountChartRow {
  year: number;
  yearLabel: string;
  minimis: number;
  non_minimis: number;
  total: number;
}

const apiUrl = import.meta.env.VITE_API_URL;

const sendFrontendLog = async (
  level: 'info' | 'warning' | 'error',
  context: string,
  message: string,
  details?: Record<string, unknown>,
) => {
  try {
    await fetch(`${apiUrl}/api/frontend_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({ level, context, message, details }),
    });
  } catch (error) {
    console.error('Could not send frontend log:', error);
  }
};

const formatProfileValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('es-ES') : null;

  const text = String(value).trim();
  if (!text) return null;
  return text;
};

const normalizeAmountToken = (rawToken: string): number | null => {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;

  let token = trimmed
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!token || token === '-') return null;

  const isNegative = token.startsWith('-');
  token = token.replace(/-/g, '');

  const hasDot = token.includes('.');
  const hasComma = token.includes(',');
  let normalized = token;

  if (hasDot && hasComma) {
    const lastDot = token.lastIndexOf('.');
    const lastComma = token.lastIndexOf(',');
    if (lastComma > lastDot) {
      // 12.480,50 -> 12480.50
      normalized = token.replace(/\./g, '').replace(',', '.');
    } else {
      // 12,480.50 -> 12480.50
      normalized = token.replace(/,/g, '');
    }
  } else if (hasComma) {
    const looksDecimal = /,\d{1,2}$/.test(token);
    normalized = looksDecimal ? token.replace(',', '.') : token.replace(/,/g, '');
  } else if (hasDot) {
    const looksDecimal = /\.\d{1,2}$/.test(token);
    normalized = looksDecimal ? token : token.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -parsed : parsed;
};

const parseGrantAmount = (value?: number | string | null): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = String(value).replace(/\u00A0/g, ' ').trim();
  if (!text) return null;

  const currencyMatches = Array.from(
    text.matchAll(/(-?\d[\d\s.,]*\d|-?\d)(?:\s*€|\s*EUR|\s*euros?)/gi),
  ).map((match) => match[1]);

  for (const candidate of currencyMatches) {
    const parsed = normalizeAmountToken(candidate);
    if (parsed !== null) return parsed;
  }

  const genericMatches = text.match(/-?\d[\d\s.,]*/g) || [];
  for (const candidate of genericMatches) {
    const parsed = normalizeAmountToken(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
};

const parseGrantYear = (value?: string): number | null => {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getFullYear();

  const fallback = value.match(/\b(19|20)\d{2}\b/);
  if (!fallback) return null;

  const year = Number(fallback[0]);
  return Number.isFinite(year) ? year : null;
};

const formatCompactEuro = (value: number) => {
  if (!Number.isFinite(value)) return '0 €';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)} K€`;
  return `${Math.round(value)} €`;
};

const extractHttpStatus = (error: unknown): number | null => {
  const candidate = (error as { status?: unknown })?.status;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;

  const message = String((error as Error)?.message || '');
  const match = message.match(/\b([1-5]\d{2})\b/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const shouldRetryEntityQuery = (failureCount: number, error: unknown) => {
  const status = extractHttpStatus(error);
  if (status !== null) {
    if (status === 429) return false;
    if (status >= 400 && status < 500) return false;
    if (status >= 500) return failureCount < 1;
  }
  return failureCount < 1;
};

const fetchUserEntities = async (): Promise<Entity[]> => {
  const response = await fetch(`${apiUrl}/api/get_user_entities`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error al obtener las entidades: ${response.status}`);
  }

  const data = await response.json();
  return data.entities || [];
};

const selectUserEntity = async (entityId: string): Promise<void> => {
  const response = await fetch(`${apiUrl}/api/select_user_entity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
    body: JSON.stringify({ entity_id: entityId }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'No se pudo seleccionar la entidad');
  }
};

const fetchEntityProfile = async (entityId: string): Promise<ProfileData> => {
  const response = await fetch(`${apiUrl}/api/get_entity_profile?entity_id=${entityId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Error al obtener el perfil de la entidad: ${response.status}`);
  }
  const data = await response.json();
  return data.profile;
};

const fetchEntityAwardedGrants = async (entityId: string): Promise<AwardedGrantResponse> => {
  const response = await fetch(`${apiUrl}/api/get_entity_awarded_grants?entity_id=${entityId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data?.message || `Error al obtener subvenciones conseguidas: ${response.status}`);
  }

  const rawGrants = data.grants || data.awards || [];

  return {
    awards: rawGrants.map((grant: any) => ({
      id: grant.id,
      titulo: grant.titulo || grant.convocatoria || 'Concesión sin título',
      organismo:
        grant.organo_convocante ||
        grant.nivel3 ||
        grant.organismo ||
        [grant.organo, grant.administracion].filter(Boolean).join(' · '),
      fecha_concesion: grant.fecha_concesion || grant.fechaConcesion || grant.fecha,
      importe: grant.importe ?? grant.importe_ayuda_equivalente ?? grant.ayuda_equivalente ?? null,
      region: grant.nivel1 || grant.region,
      departamento: grant.nivel2,
      instrumento: grant.instrumento,
      url: grant.url || grant.url_br || grant.urlBR || data.source_url,
      referencia: grant.referencia || grant.cod_concesion || grant.codConcesion || grant.identificacion_bdns,
    })),
    total: typeof data.total === 'number' ? data.total : rawGrants.length,
    source: data.source,
    sourceUrl: data.source_url,
    warning: data.warning,
  };
};

const fetchEntityMinimisGrants = async (entityId: string): Promise<MinimisGrantResponse> => {
  const response = await fetch(`${apiUrl}/api/get_entity_minimis_grants?entity_id=${entityId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data?.message || `Error al obtener minimis de la entidad: ${response.status}`);
  }

  const rawGrants = data.minimis_grants || data.minimis_awards || [];

  return {
    awards: rawGrants.map((grant: any) => ({
      id: grant.id,
      titulo:
        grant.titulo ||
        (grant.codigo_concesion || grant.referencia
          ? `Concesión minimis ${grant.codigo_concesion || grant.referencia}`
          : 'Concesión minimis'),
      convocante: grant.convocante || grant.organo_convocante,
      fecha_concesion: grant.fecha_concesion || grant.fechaConcesion || grant.fecha,
      importe: grant.importe ?? grant.ayuda_equivalente ?? grant.ayudaEquivalente ?? null,
      instrumento: grant.instrumento,
      reglamento: grant.reglamento,
      beneficiario: grant.beneficiario,
      referencia: grant.referencia || grant.codigo_concesion || grant.codigoConcesion,
      codigo_concesion: grant.codigo_concesion || grant.codigoConcesion,
      numero_convocatoria: grant.numero_convocatoria || grant.numeroConvocatoria,
    })),
    total: typeof data.total === 'number' ? data.total : rawGrants.length,
    totalLast3YearsAmount:
      typeof data.total_last_3_years_amount === 'number'
        ? data.total_last_3_years_amount
        : undefined,
    totalAmount: typeof data.total_amount === 'number' ? data.total_amount : undefined,
    countLast3Years:
      typeof data.count_last_3_years === 'number' ? data.count_last_3_years : undefined,
    cutoffDate: data.cutoff_date,
    source: data.source,
    sourceUrl: data.source_url,
    warning: data.warning,
  };
};

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized !== '' && normalized !== 'no especificado';
  }
  return true;
};

const computeProfileCompletion = (profile?: ProfileData) => {
  if (!profile) {
    return { completed: 0, total: 0, percentage: 0 };
  }

  const checks = [
    hasValue(profile.razon_social),
    hasValue(profile.nif),
    hasValue(profile.descripcion),
    hasValue(profile.tipo_empresa),
    hasValue(profile.pagina_web),
    hasValue(profile.comunidad_autonoma),
    hasValue(profile.comunidad_autonoma_centro_trabajo),
    hasValue(profile.telefono),
    hasValue(profile.correo),
    hasValue(profile.fecha_constitucion),
    hasValue(profile.direccion_social),
    hasValue(profile.cnae),
    hasValue(profile.sector),
    hasValue(profile.facturacion_anual),
    hasValue(profile.personal_en_linea),
    hasValue(profile.objeto_social),
    hasValue(profile.nombre_representante),
    typeof profile.liderado_por_mujeres === 'boolean',
    !profile.liderado_por_mujeres || hasValue(profile.porcentaje_liderado_por_mujeres),
    hasValue(profile.minimis ?? profile.concesion_minimis),
  ];

  const total = checks.length;
  const completed = checks.filter(Boolean).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
};

const formatAwardDate = (value?: string) => {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-ES');
};

const formatAwardAmount = (value?: number | string | null) => {
  const parsed = parseGrantAmount(value);
  if (parsed === null) return 'Importe no disponible';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
};

const buildBdnsConvocatoriaUrl = (numeroConvocatoria?: string) => {
  const normalized = numeroConvocatoria?.trim();
  if (!normalized) return null;
  return `https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias/${encodeURIComponent(normalized)}`;
};

const truncateWords = (text: string | undefined, maxWords: number) => {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}...`;
};

const CircularCompletion: React.FC<{ percentage: number }> = ({ percentage }) => {
  const size = 64;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background/80 px-3 py-2">
      <div className="relative h-16 w-16 shrink-0">
        <svg className="h-16 w-16 -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted-foreground/20"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="text-primary transition-all duration-500"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
          {percentage}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfil</p>
        <p className="text-sm font-medium leading-tight">Completado</p>
      </div>
    </div>
  );
};

const Entities = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isNewEntityDialogOpen, setIsNewEntityDialogOpen] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [isSwitchingEntity, setIsSwitchingEntity] = useState(false);
  const [expandedAwards, setExpandedAwards] = useState<Record<string, boolean>>({});
  const [expandedMinimisAwards, setExpandedMinimisAwards] = useState<Record<string, boolean>>({});
  const [chartYearFilter, setChartYearFilter] = useState<string>('all');
  const [chartGrantFilter, setChartGrantFilter] = useState<string>('all');
  const chartExportRef = useRef<HTMLDivElement | null>(null);

  const {
    data: entities,
    isLoading: isLoadingEntities,
    error: entitiesError,
    refetch: refetchEntities,
  } = useQuery<Entity[]>({
    queryKey: ['userEntities'],
    queryFn: fetchUserEntities,
    retry: shouldRetryEntityQuery,
    retryDelay: (attemptIndex) => Math.min(1200 * 2 ** attemptIndex, 6000),
    staleTime: 10000,
  });

  useEffect(() => {
    if (entities && entities.length > 0) {
      const preferred = entities.find((entity) => entity.is_selected) || entities[0];
      if (preferred && preferred.id !== selectedEntityId) {
        setSelectedEntityId(preferred.id);
      }
    }
  }, [entities, selectedEntityId]);

  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery<ProfileData>({
    queryKey: ['entityProfile', selectedEntityId],
    queryFn: () =>
      selectedEntityId
        ? fetchEntityProfile(selectedEntityId)
        : Promise.reject(new Error('No hay entidad seleccionada')),
    enabled: !!selectedEntityId,
    retry: shouldRetryEntityQuery,
    retryDelay: (attemptIndex) => Math.min(1200 * 2 ** attemptIndex, 6000),
  });

  const {
    data: awardedGrantsData,
    isLoading: isLoadingAwardedGrants,
    error: awardedGrantsError,
    refetch: refetchAwardedGrants,
  } = useQuery<AwardedGrantResponse>({
    queryKey: ['entityAwardedGrants', selectedEntityId],
    queryFn: () =>
      selectedEntityId
        ? fetchEntityAwardedGrants(selectedEntityId)
        : Promise.reject(new Error('No hay entidad seleccionada')),
    enabled: !!selectedEntityId && !isEditing,
    retry: shouldRetryEntityQuery,
    staleTime: 1000 * 60 * 10,
  });

  const {
    data: minimisGrantsData,
    isLoading: isLoadingMinimisGrants,
    error: minimisGrantsError,
    refetch: refetchMinimisGrants,
  } = useQuery<MinimisGrantResponse>({
    queryKey: ['entityMinimisGrants', selectedEntityId],
    queryFn: () =>
      selectedEntityId
        ? fetchEntityMinimisGrants(selectedEntityId)
        : Promise.reject(new Error('No hay entidad seleccionada')),
    enabled: !!selectedEntityId && !isEditing,
    retry: shouldRetryEntityQuery,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (profileError) {
      toast.error('Error al cargar el perfil de la entidad');
      console.error('Profile error:', profileError);
    }

    if (entitiesError) {
      toast.error('Error al cargar las entidades');
      console.error('Entities error:', entitiesError);
    }
  }, [profileError, entitiesError]);

  useEffect(() => {
    if (awardedGrantsError) {
      console.error('Awarded grants error:', awardedGrantsError);
    }
    if (minimisGrantsError) {
      console.error('Minimis grants error:', minimisGrantsError);
    }
  }, [awardedGrantsError, minimisGrantsError]);

  useEffect(() => {
    setExpandedAwards({});
    setExpandedMinimisAwards({});
    setChartYearFilter('all');
    setChartGrantFilter('all');
  }, [selectedEntityId]);

  const handleSaveProfile = () => {
    setIsEditing(false);
    refetchProfile();
    refetchAwardedGrants();
    refetchMinimisGrants();
  };

  const handleSuccessCreateEntity = async (entityId: string) => {
    await refetchEntities();
    setSelectedEntityId(entityId);
  };

  const handleEntitySelectionChange = async (entityId: string) => {
    if (!entityId || entityId === selectedEntityId || isSwitchingEntity) {
      return;
    }

    setIsSwitchingEntity(true);
    try {
      await selectUserEntity(entityId);
      setSelectedEntityId(entityId);
      await Promise.all([refetchEntities(), refetchProfile(), refetchAwardedGrants(), refetchMinimisGrants()]);
      queryClient.invalidateQueries({ queryKey: ['marketplaceGrants'] });
      queryClient.invalidateQueries({ queryKey: ['recommendedGrants'] });
      queryClient.invalidateQueries({ queryKey: ['grantsForSwipe'] });
      toast.success('Entidad seleccionada actualizada');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cambiar de entidad';
      toast.error(message);
    } finally {
      setIsSwitchingEntity(false);
    }
  };

  const selectedEntity = entities?.find((entity) => entity.id === selectedEntityId) || entities?.[0];
  const completion = useMemo(() => computeProfileCompletion(profile), [profile]);
  const totalAwardedGrants = awardedGrantsData?.total ?? awardedGrantsData?.awards?.length ?? 0;
  const totalMinimisGrants = minimisGrantsData?.total ?? minimisGrantsData?.awards?.length ?? 0;
  const minimisLast3YearsAmount = minimisGrantsData?.totalLast3YearsAmount ?? 0;
  const minimisTotalAmount = minimisGrantsData?.totalAmount ?? 0;

  const toggleAwardExpanded = (awardKey: string) => {
    setExpandedAwards((prev) => ({ ...prev, [awardKey]: !prev[awardKey] }));
  };

  const toggleMinimisExpanded = (awardKey: string) => {
    setExpandedMinimisAwards((prev) => ({ ...prev, [awardKey]: !prev[awardKey] }));
  };

  const grantAmountRecords = useMemo<GrantAmountRecord[]>(() => {
    const records: GrantAmountRecord[] = [];

    for (const award of awardedGrantsData?.awards || []) {
      const year = parseGrantYear(award.fecha_concesion);
      const amount = parseGrantAmount(award.importe);
      if (!year || amount === null || amount <= 0) continue;

      records.push({
        year,
        title: award.titulo || 'Subvención sin título',
        amount,
        category: 'non_minimis',
      });
    }

    for (const award of minimisGrantsData?.awards || []) {
      const year = parseGrantYear(award.fecha_concesion);
      const amount = parseGrantAmount(award.importe);
      if (!year || amount === null || amount <= 0) continue;

      records.push({
        year,
        title: award.titulo || 'Concesión minimis',
        amount,
        category: 'minimis',
      });
    }

    return records;
  }, [awardedGrantsData?.awards, minimisGrantsData?.awards]);

  const availableChartYears = useMemo(
    () => Array.from(new Set(grantAmountRecords.map((item) => item.year))).sort((a, b) => b - a),
    [grantAmountRecords],
  );

  const availableChartGrants = useMemo(() => {
    const scopedByYear =
      chartYearFilter === 'all'
        ? grantAmountRecords
        : grantAmountRecords.filter((item) => item.year === Number(chartYearFilter));

    return Array.from(new Set(scopedByYear.map((item) => item.title))).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' }),
    );
  }, [grantAmountRecords, chartYearFilter]);

  useEffect(() => {
    if (chartYearFilter === 'all') return;
    if (!availableChartYears.some((year) => String(year) === chartYearFilter)) {
      setChartYearFilter('all');
    }
  }, [availableChartYears, chartYearFilter]);

  useEffect(() => {
    if (chartGrantFilter === 'all') return;
    if (!availableChartGrants.includes(chartGrantFilter)) {
      setChartGrantFilter('all');
    }
  }, [availableChartGrants, chartGrantFilter]);

  const filteredGrantAmountRecords = useMemo(() => {
    return grantAmountRecords.filter((item) => {
      const matchesYear = chartYearFilter === 'all' || item.year === Number(chartYearFilter);
      const matchesGrant = chartGrantFilter === 'all' || item.title === chartGrantFilter;
      return matchesYear && matchesGrant;
    });
  }, [grantAmountRecords, chartYearFilter, chartGrantFilter]);

  const grantAmountChartData = useMemo<GrantAmountChartRow[]>(() => {
    const byYear = new Map<number, { minimis: number; nonMinimis: number }>();

    for (const item of filteredGrantAmountRecords) {
      const current = byYear.get(item.year) || { minimis: 0, nonMinimis: 0 };
      if (item.category === 'minimis') current.minimis += item.amount;
      else current.nonMinimis += item.amount;
      byYear.set(item.year, current);
    }

    return Array.from(byYear.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, values]) => ({
        year,
        yearLabel: String(year),
        minimis: values.minimis,
        non_minimis: values.nonMinimis,
        total: values.minimis + values.nonMinimis,
      }));
  }, [filteredGrantAmountRecords]);

  const chartTotals = useMemo(() => {
    return grantAmountChartData.reduce(
      (acc, row) => {
        acc.minimis += row.minimis;
        acc.nonMinimis += row.non_minimis;
        return acc;
      },
      { minimis: 0, nonMinimis: 0 },
    );
  }, [grantAmountChartData]);

  const profilePdfRows = useMemo(() => {
    if (!profile) return [] as Array<{ label: string; value: string }>;

    const entries: Array<{ label: string; value: string | null }> = [
      { label: 'Razón social', value: formatProfileValue(profile.razon_social) },
      { label: 'NIF/CIF', value: formatProfileValue(profile.nif) },
      { label: 'Descripción', value: formatProfileValue(profile.descripcion) },
      { label: 'Sector', value: formatProfileValue(profile.sector) },
      { label: 'Facturación anual', value: formatProfileValue(profile.facturacion_anual) },
      { label: 'Tipo de empresa', value: formatProfileValue(profile.tipo_empresa) },
      { label: 'Dirección social', value: formatProfileValue(profile.direccion_social) },
      { label: 'CNAE', value: formatProfileValue(profile.cnae) },
      { label: 'Centro de trabajo', value: formatProfileValue(profile.centro_trabajo) },
      { label: 'Comunidad autónoma', value: formatProfileValue(profile.comunidad_autonoma) },
      {
        label: 'Comunidad autónoma centro trabajo',
        value: formatProfileValue(profile.comunidad_autonoma_centro_trabajo),
      },
      { label: 'Teléfono', value: formatProfileValue(profile.telefono) },
      { label: 'Correo', value: formatProfileValue(profile.correo) },
      {
        label: 'Personal en plantilla',
        value: formatProfileValue(profile.personal_en_linea ?? profile.personal_linea),
      },
      { label: 'Fecha de constitución', value: formatProfileValue(profile.fecha_constitucion) },
      { label: 'Objeto social', value: formatProfileValue(profile.objeto_social) },
      { label: 'Administrador', value: formatProfileValue(profile.administrador_nombre) },
      { label: 'Cargo administrador', value: formatProfileValue(profile.administrador_cargo) },
      { label: 'Año administrador', value: formatProfileValue(profile.administrador_año) },
      { label: 'Representante', value: formatProfileValue(profile.nombre_representante) },
      { label: 'Página web', value: formatProfileValue(profile.pagina_web) },
      {
        label: 'Liderado por mujeres',
        value: formatProfileValue(profile.liderado_por_mujeres ?? profile.liderado_mujeres),
      },
      {
        label: '% liderazgo femenino',
        value: formatProfileValue(
          profile.porcentaje_liderado_por_mujeres ?? profile.porcentaje_mujeres,
        ),
      },
      {
        label: 'Minimis declarada',
        value: formatProfileValue(profile.minimis ?? profile.concesion_minimis),
      },
    ];

    return entries
      .filter((entry) => entry.value !== null)
      .map((entry) => ({ label: entry.label, value: entry.value as string }));
  }, [profile]);

  const exportChartSvgAsDataUrl = async (
    mimeType: 'image/jpeg' | 'image/png',
    quality = 0.92,
  ): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    const svg = chartExportRef.current?.querySelector('svg');
    if (!svg || !chartExportRef.current) {
      void sendFrontendLog('warning', 'entities_chart_export', 'SVG del gráfico no disponible', {
        hasContainer: Boolean(chartExportRef.current),
      });
      return null;
    }

    const bounds = svg.getBoundingClientRect();
    const width = Math.max(1100, Math.round(bounds.width * 2));
    const height = Math.max(620, Math.round(bounds.height * 2));
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));

    const originalViewBox = svg.getAttribute('viewBox');
    if (originalViewBox) {
      clonedSvg.setAttribute('viewBox', originalViewBox);
    } else {
      const safeWidth = Math.max(1, Math.round(bounds.width));
      const safeHeight = Math.max(1, Math.round(bounds.height));
      clonedSvg.setAttribute('viewBox', `0 0 ${safeWidth} ${safeHeight}`);
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

    try {
      const result = await new Promise<{ dataUrl: string; width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('No se pudo crear canvas'));
            return;
          }

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);

          resolve({
            dataUrl: canvas.toDataURL(mimeType, quality),
            width,
            height,
          });
        };
        image.onerror = () => {
          void sendFrontendLog('error', 'entities_chart_export', 'No se pudo renderizar la imagen del gráfico', {
            mimeType,
            width,
            height,
            cspHint: 'img-src bloqueando esquema no permitido',
          });
          reject(new Error('No se pudo renderizar la imagen del gráfico'));
        };
        image.src = svgDataUrl;
      });
      return result;
    } catch (error) {
      console.error('Error exporting chart image:', error);
      void sendFrontendLog('error', 'entities_chart_export', 'Error exportando imagen de gráfico', {
        mimeType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  const exportChartCardAsDataUrl = async (
    mimeType: 'image/jpeg' | 'image/png',
    quality = 0.92,
  ): Promise<string | null> => {
    const chartImage = await exportChartSvgAsDataUrl('image/png', 1);
    if (!chartImage) return null;

    try {
      const chartBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo cargar la imagen base del gráfico'));
        image.src = chartImage.dataUrl;
      });

      const canvasWidth = Math.max(1600, chartImage.width + 180);
      const horizontalPadding = 56;
      const kpiGap = 16;
      const kpiHeight = 94;
      const chartBoxTopPadding = 24;
      const chartBoxBottomPadding = 24;
      const chartBoxHorizontalPadding = 24;
      const titleStartY = 72;
      const subtitleLineHeight = 34;
      const canvasHeight = Math.max(
        980,
        chartImage.height + 560,
      );

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('No se pudo crear canvas para la exportación completa');
      }

      const drawRoundedRect = (
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
      ) => {
        const r = Math.min(radius, width / 2, height / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.lineTo(x + width - r, y);
        context.quadraticCurveTo(x + width, y, x + width, y + r);
        context.lineTo(x + width, y + height - r);
        context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        context.lineTo(x + r, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - r);
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.closePath();
      };

      const drawWrappedText = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
      ) => {
        const words = text.split(/\s+/).filter(Boolean);
        let line = '';
        let cursorY = y;

        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (line && context.measureText(candidate).width > maxWidth) {
            context.fillText(line, x, cursorY);
            line = word;
            cursorY += lineHeight;
          } else {
            line = candidate;
          }
        }

        if (line) {
          context.fillText(line, x, cursorY);
        }

        return cursorY;
      };

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      context.fillStyle = '#111827';
      context.font = '700 48px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      context.fillText('Evolución anual de subvenciones', horizontalPadding, titleStartY);

      context.fillStyle = '#4B5563';
      context.font = '400 28px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      const subtitleEndY = drawWrappedText(
        'Diferenciación entre minimis y no minimis, con filtros por año y subvención.',
        horizontalPadding,
        titleStartY + 52,
        canvasWidth - horizontalPadding * 2,
        subtitleLineHeight,
      );

      const filterText = `Año: ${chartYearFilter === 'all' ? 'Todos' : chartYearFilter} · Subvención: ${chartGrantFilter === 'all' ? 'Todas' : chartGrantFilter}`;
      context.fillStyle = '#6B7280';
      context.font = '500 22px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      context.fillText(filterText, horizontalPadding, subtitleEndY + 44);

      const kpiStartY = subtitleEndY + 70;
      const kpiCardWidth = (canvasWidth - horizontalPadding * 2 - kpiGap * 2) / 3;
      const kpiDefinitions = [
        { label: 'Total no minimis', value: formatAwardAmount(chartTotals.nonMinimis), bg: '#A78BFA' },
        { label: 'Total minimis', value: formatAwardAmount(chartTotals.minimis), bg: '#3966DF' },
        {
          label: 'Total combinado',
          value: formatAwardAmount(chartTotals.nonMinimis + chartTotals.minimis),
          bg: '#F3F4F6',
        },
      ];

      kpiDefinitions.forEach((kpi, index) => {
        const x = horizontalPadding + index * (kpiCardWidth + kpiGap);
        drawRoundedRect(x, kpiStartY, kpiCardWidth, kpiHeight, 16);
        context.fillStyle = kpi.bg;
        context.fill();
        context.strokeStyle = '#D1D5DB';
        context.lineWidth = 1;
        context.stroke();

        context.fillStyle = '#6B7280';
        context.font = '600 16px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        context.fillText(kpi.label.toUpperCase(), x + 16, kpiStartY + 30);

        context.fillStyle = '#111827';
        context.font = '700 26px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        context.fillText(kpi.value, x + 16, kpiStartY + 68);
      });

      const chartBoxY = kpiStartY + kpiHeight + 26;
      const chartBoxWidth = canvasWidth - horizontalPadding * 2;
      const chartBoxHeight = canvasHeight - chartBoxY - 48;
      drawRoundedRect(horizontalPadding, chartBoxY, chartBoxWidth, chartBoxHeight, 18);
      context.fillStyle = '#FFFFFF';
      context.fill();
      context.strokeStyle = '#D1D5DB';
      context.lineWidth = 1;
      context.stroke();

      const innerChartWidth = chartBoxWidth - chartBoxHorizontalPadding * 2;
      const innerChartHeight = chartBoxHeight - chartBoxTopPadding - chartBoxBottomPadding;
      const scale = Math.min(innerChartWidth / chartImage.width, innerChartHeight / chartImage.height);
      const drawWidth = Math.round(chartImage.width * scale);
      const drawHeight = Math.round(chartImage.height * scale);
      const drawX = horizontalPadding + chartBoxHorizontalPadding + Math.round((innerChartWidth - drawWidth) / 2);
      const drawY = chartBoxY + chartBoxTopPadding + Math.round((innerChartHeight - drawHeight) / 2);

      context.drawImage(chartBitmap, drawX, drawY, drawWidth, drawHeight);

      return canvas.toDataURL(mimeType, quality);
    } catch (error) {
      console.error('Error exporting full chart card image:', error);
      void sendFrontendLog('error', 'entities_chart_export_full', 'Error exportando imagen completa del bloque', {
        mimeType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  const handleDownloadChartJpg = async () => {
    const imageDataUrl = await exportChartCardAsDataUrl('image/jpeg', 0.92);
    if (!imageDataUrl) {
      toast.error('No se pudo preparar el gráfico para descargar');
      void sendFrontendLog('error', 'entities_chart_jpg', 'No se pudo preparar el gráfico JPG');
      return;
    }

    const link = document.createElement('a');
    const yearTag = chartYearFilter === 'all' ? 'todos' : chartYearFilter;
    const dateTag = new Date().toISOString().slice(0, 10);
    link.href = imageDataUrl;
    link.download = `subvenciones-por-anio-${yearTag}-${dateTag}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Gráfico descargado en JPG');
  };

  const handleDownloadTechnicalSheetPdf = async () => {
    if (!selectedEntity) {
      toast.error('No hay entidad seleccionada');
      void sendFrontendLog('warning', 'entities_pdf_export', 'Sin entidad seleccionada para PDF');
      return;
    }

    const chartDataUrl = await exportChartCardAsDataUrl('image/jpeg', 0.92);
    const requestBody = {
      entity_id: selectedEntity.id,
      entity_name: selectedEntity.razon_social || profile?.razon_social || 'Entidad',
      entity_nif: selectedEntity.nif || profile?.nif || 'No disponible',
      generated_at: new Date().toISOString(),
      chart_filters: {
        year: chartYearFilter === 'all' ? 'Todos' : chartYearFilter,
        grant: chartGrantFilter === 'all' ? 'Todas' : chartGrantFilter,
      },
      chart_summary: {
        total_non_minimis: formatAwardAmount(chartTotals.nonMinimis),
        total_minimis: formatAwardAmount(chartTotals.minimis),
        total_combined: formatAwardAmount(chartTotals.nonMinimis + chartTotals.minimis),
      },
      chart_image_data_url: chartDataUrl,
      profile_rows: profilePdfRows,
      awarded_rows: (awardedGrantsData?.awards || []).map((award) => ({
        titulo: award.titulo || 'Sin título',
        organo: award.organismo || 'No especificado',
        fecha: formatAwardDate(award.fecha_concesion),
        importe: formatAwardAmount(award.importe),
        enlace: award.url || '-',
      })),
      minimis_rows: (minimisGrantsData?.awards || []).map((award) => ({
        titulo: award.titulo || 'Sin título',
        convocante: award.convocante || 'No especificado',
        fecha: formatAwardDate(award.fecha_concesion),
        importe: formatAwardAmount(award.importe),
        enlace_bdns: buildBdnsConvocatoriaUrl(award.numero_convocatoria) || '-',
      })),
    };

    try {
      const response = await fetch(`${apiUrl}/api/entities/download_technical_sheet_pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.error || 'No se pudo generar el PDF';
        void sendFrontendLog('error', 'entities_pdf_export', 'Backend devolvió error en descarga PDF', {
          status: response.status,
          message,
        });
        toast.error(message);
        return;
      }

      const pdfBlob = await response.blob();
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const disposition = response.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^\";]+)"?/i);
      const extractedFilename = decodeURIComponent(filenameMatch?.[1] || filenameMatch?.[2] || '');

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = extractedFilename || `ficha_tecnica_${selectedEntity.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      void sendFrontendLog('info', 'entities_pdf_export', 'PDF descargado correctamente', {
        awardedCount: requestBody.awarded_rows.length,
        minimisCount: requestBody.minimis_rows.length,
        hasChart: Boolean(chartDataUrl),
      });
      toast.success('Ficha técnica descargada en PDF');
    } catch (error) {
      console.error('Error downloading technical sheet PDF:', error);
      void sendFrontendLog('error', 'entities_pdf_export', 'Error en descarga PDF (frontend)', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('No se pudo descargar la ficha técnica');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background md:pl-20">
      <main className="flex-1 pt-20 pb-16 px-3 sm:px-5 lg:px-8 flex flex-col items-center">
        <div className="w-full max-w-[92rem] space-y-6">
          <div className="rounded-2xl border bg-card/80 p-4 shadow-sm sm:p-5">
            {isLoadingEntities ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cargando entidad...</span>
              </div>
            ) : entities && entities.length > 0 ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Building className="h-3.5 w-3.5" />
                    <span>Entidad vinculada a tu cuenta</span>
                  </div>
                  {entities.length > 1 ? (
                    <div className="mt-2 flex items-center gap-2">
                      <label htmlFor="entity-selector" className="text-xs text-muted-foreground">
                        Entidad activa:
                      </label>
                      <select
                        id="entity-selector"
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                        value={selectedEntityId ?? ''}
                        disabled={isSwitchingEntity}
                        onChange={(event) => handleEntitySelectionChange(event.target.value)}
                      >
                        {entities.map((entity) => (
                          <option key={entity.id} value={entity.id}>
                            {entity.razon_social}
                          </option>
                        ))}
                      </select>
                      {isSwitchingEntity ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                    </div>
                  ) : null}
                  <h1 className="mt-1 truncate text-xl font-semibold sm:text-2xl">
                    {selectedEntity?.razon_social || profile?.razon_social || 'Entidad'}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedEntity?.nif || profile?.nif ? `CIF/NIF: ${selectedEntity?.nif || profile?.nif}` : 'Completa la información fiscal de la entidad'}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aquí gestionas el perfil de tu entidad y consultamos las subvenciones que ya ha obtenido para darte más contexto.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                  {profile && <CircularCompletion percentage={completion.percentage} />}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTechnicalSheetPdf}
                    className="w-full sm:w-auto"
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Descargar PDF
                  </Button>
                </div>
              </div>
            ) : (
              <Card className="border-dashed bg-muted/30">
                <CardContent className="p-4 text-center text-sm text-muted-foreground">
                  No hay entidades disponibles
                </CardContent>
              </Card>
            )}
          </div>

          {isLoadingProfile || (isLoadingEntities && !profile) ? (
            <div className="flex w-full items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedEntityId && profile ? (
            isEditing ? (
              <ProfileEditForm
                profile={profile}
                entityId={selectedEntityId}
                onCancel={() => setIsEditing(false)}
                onSave={handleSaveProfile}
              />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
                  <div className="space-y-6">
                    <ProfileCard profile={profile} onEdit={() => setIsEditing(true)} />
                    <EntityDocuments entityId={selectedEntityId} />

                    <Card>
                      <CardHeader className="pb-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <CardTitle className="text-base">
                              Evolución anual de subvenciones
                            </CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Diferenciación entre minimis y no minimis, con filtros por año y subvención.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadChartJpg}
                            disabled={grantAmountChartData.length === 0}
                            className="w-full lg:w-auto"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Descargar JPG
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <label htmlFor="chart-year-filter" className="text-xs font-medium text-muted-foreground">
                              Año
                            </label>
                            <select
                              id="chart-year-filter"
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                              value={chartYearFilter}
                              onChange={(event) => setChartYearFilter(event.target.value)}
                            >
                              <option value="all">Todos los años</option>
                              {availableChartYears.map((year) => (
                                <option key={year} value={String(year)}>
                                  {year}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label htmlFor="chart-grant-filter" className="text-xs font-medium text-muted-foreground">
                              Subvención
                            </label>
                            <select
                              id="chart-grant-filter"
                              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                              value={chartGrantFilter}
                              onChange={(event) => setChartGrantFilter(event.target.value)}
                            >
                              <option value="all">Todas las subvenciones</option>
                              {availableChartGrants.map((title) => (
                                <option key={title} value={title}>
                                  {title}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-lg border bg-muted/20 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Total no minimis
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {formatAwardAmount(chartTotals.nonMinimis)}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Total minimis
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {formatAwardAmount(chartTotals.minimis)}
                            </p>
                          </div>
                          <div className="rounded-lg border bg-muted/20 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Total combinado
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {formatAwardAmount(chartTotals.nonMinimis + chartTotals.minimis)}
                            </p>
                          </div>
                        </div>

                        {grantAmountChartData.length === 0 ? (
                          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                            No hay importes con fecha disponibles para construir el gráfico con los filtros actuales.
                          </div>
                        ) : (
                          <div
                            ref={chartExportRef}
                            className="rounded-xl border bg-background/60 p-3 sm:p-4"
                          >
                            <div className="h-[280px] sm:h-[360px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={grantAmountChartData}
                                  margin={{ top: 10, right: 10, left: 0, bottom: 4 }}
                                >
                                  <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.35} />
                                  <XAxis dataKey="yearLabel" tickLine={false} axisLine={false} fontSize={12} />
                                  <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    width={60}
                                    fontSize={11}
                                    tickFormatter={(value) => formatCompactEuro(Number(value))}
                                  />
                                  <Tooltip
                                    formatter={(value: number) =>
                                      new Intl.NumberFormat('es-ES', {
                                        style: 'currency',
                                        currency: 'EUR',
                                        maximumFractionDigits: 0,
                                      }).format(Number(value))
                                    }
                                    labelFormatter={(label) => `Año ${label}`}
                                  />
                                  <Legend />
                                  <Bar
                                    dataKey="non_minimis"
                                    name="No minimis"
                                    stackId="amounts"
                                    fill="#A78BFA"
                                    radius={[4, 4, 0, 0]}
                                  />
                                  <Bar
                                    dataKey="minimis"
                                    name="Minimis"
                                    stackId="amounts"
                                    fill="#3966DF"
                                    radius={[4, 4, 0, 0]}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                <div className="h-fit xl:sticky xl:top-24">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Trophy className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">Subvenciones Conseguidas</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Histórico de concesiones y minimis de la entidad
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="awarded" className="w-full">
                        <TabsList className="grid h-auto w-full grid-cols-2">
                          <TabsTrigger value="awarded" className="text-xs sm:text-sm">
                            Conseguidas ({totalAwardedGrants})
                          </TabsTrigger>
                          <TabsTrigger value="minimis" className="text-xs sm:text-sm">
                            Minimis ({totalMinimisGrants})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="awarded" className="pt-3">
                          <div className="space-y-3">
                            {awardedGrantsData?.warning ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                                {awardedGrantsData.warning}
                              </div>
                            ) : null}

                            {isLoadingAwardedGrants ? (
                              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Cargando subvenciones concedidas...</span>
                              </div>
                            ) : awardedGrantsError ? (
                              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                                No hay subvenciones concedidas.
                              </div>
                            ) : (awardedGrantsData?.awards || []).length === 0 ? (
                              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                                No se han encontrado concesiones para el CIF de esta entidad.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {(awardedGrantsData?.awards || []).map((award, index) => {
                                  const awardKey = `${award.id || award.referencia || award.titulo}-${index}`;
                                  const isExpanded = !!expandedAwards[awardKey];
                                  const shortTitle = truncateWords(award.titulo, 10);

                                  return (
                                    <button
                                      key={awardKey}
                                      type="button"
                                      onClick={() => toggleAwardExpanded(awardKey)}
                                      className="w-full rounded-xl border bg-background p-3 text-left transition-colors hover:bg-muted/20"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary" className="font-normal">
                                          {formatAwardAmount(award.importe)}
                                        </Badge>
                                        {award.region ? (
                                          <Badge variant="outline" className="font-normal">
                                            {award.region}
                                          </Badge>
                                        ) : null}
                                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                                          {isExpanded ? 'Ver menos' : 'Ver más'}
                                          {isExpanded ? (
                                            <ChevronUp className="h-3.5 w-3.5" />
                                          ) : (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          )}
                                        </span>
                                      </div>

                                      <h3 className="mt-2 text-sm font-semibold leading-snug">
                                        {isExpanded ? award.titulo : shortTitle}
                                      </h3>

                                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                        {award.organismo ? (
                                          <div className="flex items-start gap-2">
                                            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Órgano convocante:</span>{' '}
                                              {award.organismo}
                                            </span>
                                          </div>
                                        ) : null}
                                        {award.fecha_concesion ? (
                                          <div className="flex items-center gap-2">
                                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Fecha:</span>{' '}
                                              {formatAwardDate(award.fecha_concesion)}
                                            </span>
                                          </div>
                                        ) : null}
                                        {isExpanded && award.departamento ? (
                                          <div className="flex items-start gap-2">
                                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Departamento:</span>{' '}
                                              {award.departamento}
                                            </span>
                                          </div>
                                        ) : null}
                                        {isExpanded && award.instrumento ? (
                                          <div className="flex items-start gap-2">
                                            <BadgeEuro className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Instrumento:</span>{' '}
                                              {award.instrumento}
                                            </span>
                                          </div>
                                        ) : null}
                                        {award.url ? (
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                                            <a
                                              href={award.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="truncate text-primary hover:underline"
                                            >
                                              Ver en BDNS
                                            </a>
                                          </div>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="minimis" className="pt-3">
                          <div className="space-y-3">
                            {minimisGrantsData?.warning ? (
                              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                                {minimisGrantsData.warning}
                              </div>
                            ) : null}

                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                              <div className="rounded-xl border bg-muted/20 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  Total minimis (últimos 3 años)
                                </p>
                                <p className="mt-1 text-base font-semibold">
                                  {formatAwardAmount(minimisLast3YearsAmount)}
                                </p>
                                {minimisGrantsData?.cutoffDate ? (
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    Desde {formatAwardDate(minimisGrantsData.cutoffDate)}
                                  </p>
                                ) : null}
                              </div>

                              <div className="rounded-xl border bg-muted/20 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  Histórico minimis
                                </p>
                                <p className="mt-1 text-base font-semibold">
                                  {formatAwardAmount(minimisTotalAmount)}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {totalMinimisGrants} subvenciones registradas
                                </p>
                              </div>
                            </div>

                            {isLoadingMinimisGrants ? (
                              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Cargando concesiones minimis...</span>
                              </div>
                            ) : minimisGrantsError ? (
                              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                                No hay subvenciones minimis concedidas.
                              </div>
                            ) : (minimisGrantsData?.awards || []).length === 0 ? (
                              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                                No se han encontrado concesiones minimis para el CIF de esta entidad.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {(minimisGrantsData?.awards || []).map((award, index) => {
                                  const awardKey = `${award.id || award.referencia || award.titulo}-${index}`;
                                  const isExpanded = !!expandedMinimisAwards[awardKey];
                                  const shortTitle = truncateWords(award.titulo, 10);
                                  const minimisBdnsUrl = buildBdnsConvocatoriaUrl(award.numero_convocatoria);

                                  return (
                                    <button
                                      key={awardKey}
                                      type="button"
                                      onClick={() => toggleMinimisExpanded(awardKey)}
                                      className="w-full rounded-xl border bg-background p-3 text-left transition-colors hover:bg-muted/20"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary" className="font-normal">
                                          {formatAwardAmount(award.importe)}
                                        </Badge>
                                        {award.reglamento ? (
                                          <Badge variant="outline" className="max-w-full font-normal">
                                            <span className="truncate">
                                              {truncateWords(award.reglamento, 5)}
                                            </span>
                                          </Badge>
                                        ) : null}
                                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                                          {isExpanded ? 'Ver menos' : 'Ver más'}
                                          {isExpanded ? (
                                            <ChevronUp className="h-3.5 w-3.5" />
                                          ) : (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          )}
                                        </span>
                                      </div>

                                      <h3 className="mt-2 text-sm font-semibold leading-snug">
                                        {isExpanded ? award.titulo : shortTitle}
                                      </h3>

                                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                        {award.convocante ? (
                                          <div className="flex items-start gap-2">
                                            <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Órgano convocante:</span>{' '}
                                              {award.convocante}
                                            </span>
                                          </div>
                                        ) : null}
                                        {award.fecha_concesion ? (
                                          <div className="flex items-center gap-2">
                                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Fecha:</span>{' '}
                                              {formatAwardDate(award.fecha_concesion)}
                                            </span>
                                          </div>
                                        ) : null}
                                        {minimisBdnsUrl ? (
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                                            <a
                                              href={minimisBdnsUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="truncate text-primary hover:underline"
                                            >
                                              Ver en BDNS
                                            </a>
                                          </div>
                                        ) : null}
                                        {isExpanded && award.instrumento ? (
                                          <div className="flex items-start gap-2">
                                            <BadgeEuro className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Instrumento:</span>{' '}
                                              {award.instrumento}
                                            </span>
                                          </div>
                                        ) : null}
                                        {isExpanded && award.reglamento ? (
                                          <div className="flex items-start gap-2">
                                            <Building className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Reglamento:</span>{' '}
                                              {award.reglamento}
                                            </span>
                                          </div>
                                        ) : null}
                                        {isExpanded && award.beneficiario ? (
                                          <div className="flex items-start gap-2">
                                            <Building className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                              <span className="font-medium text-foreground">Beneficiario:</span>{' '}
                                              {award.beneficiario}
                                            </span>
                                          </div>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>

                </div>
              </div>
            )
          ) : entities && entities.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-8 text-center">
              <Building className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No tienes entidades</h3>
              <p className="mb-4 text-muted-foreground">
                Crea tu primera entidad para gestionar sus datos y subvenciones
              </p>
              <Button onClick={() => setIsNewEntityDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear entidad
              </Button>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No se pudo cargar el perfil</p>
              <Button onClick={() => refetchProfile()} className="mt-4">
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </main>

      <EntityCreateForm
        isOpen={isNewEntityDialogOpen}
        onOpenChange={setIsNewEntityDialogOpen}
        onSuccess={handleSuccessCreateEntity}
      />
    </div>
  );
};

export default Entities;
