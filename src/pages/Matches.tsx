import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, SlidersHorizontal, RotateCcw, Download, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import MatchCard from '@/components/MatchCard';
import {
  MarketplaceSidebar,
  type FilterOption,
  type MarketplaceFilterKey,
} from '@/components/marketplace/MarketplaceSidebar';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Match {
  grant_id: string;
  title: string;
  amount: string;
  importe_beneficiario?: string;
  deadline: string;
  justificacion: string;
  resumen: string;
  beneficiario?: string;
  beneficiarios?: string;
  lugar?: string;
  region_impacto?: string;
  finalidad?: string;
  administracion_convocante?: string;
  tipo_ayuda?: string;
  fecha_inicio_solicitud?: string;
  fecha_de_inicio?: string;
  fecha_de_cierre?: string;
  numero_match?: number;
}

interface MarketplaceFilters {
  beneficiarios: string[];
  regiones: string[];
  finalidades: string[];
  administraciones_convocantes: string[];
  tipos_ayuda: string[];
}

interface MarketplaceFilterOptionsResponse {
  beneficiarios: FilterOption[];
  regiones: FilterOption[];
  finalidades: FilterOption[];
  administraciones_convocantes: FilterOption[];
  tipos_ayuda: FilterOption[];
}

interface DateWindowFilter {
  fecha_de_inicio: string;
  fecha_de_cierre: string;
}

const apiUrl = import.meta.env.VITE_API_URL;
const AMOUNT_RANGE_MIN = 0;
const AMOUNT_RANGE_MAX = 50_000_000;
const DEFAULT_AMOUNT_RANGE: [number, number] = [AMOUNT_RANGE_MIN, AMOUNT_RANGE_MAX];
const DEFAULT_DATE_WINDOW: DateWindowFilter = { fecha_de_inicio: '', fecha_de_cierre: '' };

const emptyMarketplaceFilters: MarketplaceFilters = {
  beneficiarios: [],
  regiones: [],
  finalidades: [],
  administraciones_convocantes: [],
  tipos_ayuda: [],
};

const normalize = (value?: string) => (value || '').toLowerCase().trim();
const normalizeLoose = (value?: string) =>
  normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const parseRateLimitWaitMs = async (response: Response): Promise<number> => {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 30000);
  }

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      const retryAfter = Number(payload?.retry_after);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        return Math.min(retryAfter * 1000, 30000);
      }
    }
  } catch {
    // best effort
  }

  return 5000;
};

const beneficiariosSlugMap: Record<string, string> = {
  pyme: 'pyme',
  autonomo: 'autonomo',
  'gran-empresa': 'gran empresa',
  'entidad-sin-animo-de-lucro': 'entidad sin animo lucro',
  asociacion: 'asociacion',
};

const finalidadesSlugMap: Record<string, string> = {
  'acceso-vivienda': 'acceso a la vivienda y fomento de la edificacion',
  'comercio-turismo-pymes': 'comercio, turismo y pymes',
  desempleo: 'desempleo',
  'fomento-empleo': 'fomento del empleo',
  'industria-energia': 'industria y energia',
  infraestructuras: 'infraestructuras',
  'investigacion-desarrollo-innovacion': 'investigacion, desarrollo e innovacion',
  'otras-actuaciones-economicas': 'otras actuaciones de caracter economico',
  'otras-prestaciones-economicas': 'otras prestaciones economicas',
  'subvenciones-transporte': 'subvenciones al transporte',
};

const regionesSlugMap: Record<string, string> = {
  andalucia: 'andalucia',
  aragon: 'aragon',
  asturias: 'asturias',
  'islas-baleares': 'illes balears',
  canarias: 'canarias',
  cantabria: 'cantabria',
  'castilla-la-mancha': 'castilla la mancha',
  'castilla-y-leon': 'castilla y leon',
  cataluna: 'cataluna',
  'comunitat-valenciana': 'comunitat valenciana',
  extremadura: 'extremadura',
  galicia: 'galicia',
  'comunidad-de-madrid': 'comunidad de madrid',
  'region-de-murcia': 'region de murcia',
  navarra: 'comunidad foral de navarra',
  'pais-vasco': 'pais vasco',
  'la-rioja': 'la rioja',
  ceuta: 'ceuta',
  melilla: 'melilla',
  almeria: 'almeria',
  cadiz: 'cadiz',
  cordoba: 'cordoba',
  granada: 'granada',
  huelva: 'huelva',
  jaen: 'jaen',
  malaga: 'malaga',
  sevilla: 'sevilla',
  huesca: 'huesca',
  teruel: 'teruel',
  zaragoza: 'zaragoza',
  'las-palmas': 'las palmas',
  'santa-cruz-de-tenerife': 'santa cruz de tenerife',
  albacete: 'albacete',
  'ciudad-real': 'ciudad real',
  cuenca: 'cuenca',
  guadalajara: 'guadalajara',
  toledo: 'toledo',
  avila: 'avila',
  burgos: 'burgos',
  leon: 'leon',
  palencia: 'palencia',
  salamanca: 'salamanca',
  segovia: 'segovia',
  soria: 'soria',
  valladolid: 'valladolid',
  zamora: 'zamora',
  barcelona: 'barcelona',
  girona: 'girona',
  lleida: 'lleida',
  tarragona: 'tarragona',
  alicante: 'alicante',
  castellon: 'castellon',
  valencia: 'valencia',
  badajoz: 'badajoz',
  caceres: 'caceres',
  'a-coruna': 'a coruna',
  lugo: 'lugo',
  ourense: 'ourense',
  pontevedra: 'pontevedra',
  madrid: 'madrid',
  murcia: 'murcia',
  alava: 'alava',
  bizkaia: 'bizkaia',
  gipuzkoa: 'gipuzkoa',
};

const parseAmountToNumber = (raw?: string): number | null => {
  if (!raw) return null;

  const matches = raw.match(/\d[\d.,]*/g);
  if (!matches?.length) return null;

  const candidates = matches
    .map((token) => {
      const cleaned = token.replace(/\./g, '').replace(',', '.');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((v): v is number => v !== null);

  if (!candidates.length) return null;
  return Math.max(...candidates);
};

const amountMatchesRange = (amount: string, range: [number, number]) => {
  const [minAmount, maxAmount] = range;
  if (minAmount === AMOUNT_RANGE_MIN && maxAmount === AMOUNT_RANGE_MAX) return true;

  const value = parseAmountToNumber(amount);
  if (value === null) return false;
  return value >= minAmount && value <= maxAmount;
};

const formatEuroRangeValue = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);

const normalizeIsoDateOnly = (value?: string | null) => {
  if (!value) return '';
  const text = String(value).trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const dateCandidate = new Date(text);
  if (Number.isNaN(dateCandidate.getTime())) return '';
  return dateCandidate.toISOString().slice(0, 10);
};

const formatIsoDateForBadge = (value?: string) => {
  const iso = normalizeIsoDateOnly(value);
  if (!iso) return 'Sin filtro';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const matchDatesWindow = (match: Match, dateWindow: DateWindowFilter) => {
  const startFilter = normalizeIsoDateOnly(dateWindow.fecha_de_inicio);
  const endFilter = normalizeIsoDateOnly(dateWindow.fecha_de_cierre);

  if (!startFilter && !endFilter) return true;

  const matchStart = normalizeIsoDateOnly(match.fecha_de_inicio || match.fecha_inicio_solicitud);
  const matchEnd = normalizeIsoDateOnly(match.fecha_de_cierre);

  if (startFilter && (!matchStart || matchStart < startFilter)) return false;
  if (endFilter && (!matchEnd || matchEnd > endFilter)) return false;
  return true;
};

const includesAny = (haystack: string | undefined, needles: string[]) => {
  if (!needles.length) return true;
  const h = normalizeLoose(haystack);
  return needles.some((needle) => h.includes(normalizeLoose(needle)));
};

const fetchMarketplaceFilterOptions = async (): Promise<MarketplaceFilterOptionsResponse> => {
  const response = await fetch(`${apiUrl}/api/get_filter_options`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Error al cargar opciones de filtros');
  }

  const data = await response.json();

  const normalizeOptions = (value: unknown): FilterOption[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const rawValue = 'value' in item ? String((item as { value?: unknown }).value ?? '').trim() : '';
        const rawLabel = 'label' in item ? String((item as { label?: unknown }).label ?? '').trim() : '';
        const finalValue = rawValue || rawLabel;
        const finalLabel = rawLabel || rawValue;
        if (!finalValue || !finalLabel) return null;
        return { value: finalValue, label: finalLabel };
      })
      .filter((option): option is FilterOption => option !== null);
  };

  return {
    beneficiarios: normalizeOptions(data?.beneficiarios),
    regiones: normalizeOptions(data?.regiones),
    finalidades: normalizeOptions(data?.finalidades),
    administraciones_convocantes: normalizeOptions(data?.administraciones_convocantes),
    tipos_ayuda: normalizeOptions(data?.tipos_ayuda),
  };
};

const fetchBestMatches = async (): Promise<Match[]> => {
  const doRequest = () => fetch(`${apiUrl}/api/get_best_matches`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  let response = await doRequest();

  if (response.status === 429) {
    const waitMs = await parseRateLimitWaitMs(response);
    await sleep(waitMs);
    response = await doRequest();
  }

  if (response.status === 401) return [];
  if (response.status === 429) {
    throw new Error('Demasiadas solicitudes al cargar matches. Espera unos segundos e inténtalo de nuevo.');
  }
  if (!response.ok) {
    throw new Error(`Error al obtener los mejores matches (${response.status})`);
  }

  const data = await response.json();
  return data.matches || [];
};

const Matches = () => {
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [activeFilters, setActiveFilters] = useState<MarketplaceFilters>(emptyMarketplaceFilters);
  const [draftFilters, setDraftFilters] = useState<MarketplaceFilters>(emptyMarketplaceFilters);
  const [amountRange, setAmountRange] = useState<[number, number]>(DEFAULT_AMOUNT_RANGE);
  const [draftAmountRange, setDraftAmountRange] = useState<[number, number]>(DEFAULT_AMOUNT_RANGE);
  const [dateWindow, setDateWindow] = useState<DateWindowFilter>(DEFAULT_DATE_WINDOW);
  const [draftDateWindow, setDraftDateWindow] = useState<DateWindowFilter>(DEFAULT_DATE_WINDOW);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const {
    data: matches = [],
    isLoading: isLoadingMatches,
    error: matchesError,
  } = useQuery<Match[]>({
    queryKey: ['bestMatches'],
    queryFn: fetchBestMatches,
  });

  const { data: marketplaceFilterOptions } = useQuery<MarketplaceFilterOptionsResponse>({
    queryKey: ['marketplaceFilterOptions'],
    queryFn: fetchMarketplaceFilterOptions,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!marketplaceFilterOptions) return;
    console.log('🧩 Matches filter options loaded', {
      counts: {
        beneficiarios: marketplaceFilterOptions.beneficiarios?.length ?? 0,
        regiones: marketplaceFilterOptions.regiones?.length ?? 0,
        finalidades: marketplaceFilterOptions.finalidades?.length ?? 0,
        administraciones_convocantes: marketplaceFilterOptions.administraciones_convocantes?.length ?? 0,
        tipos_ayuda: marketplaceFilterOptions.tipos_ayuda?.length ?? 0,
      },
      sample: {
        administraciones_convocantes: marketplaceFilterOptions.administraciones_convocantes?.slice(0, 5),
        tipos_ayuda: marketplaceFilterOptions.tipos_ayuda?.slice(0, 5),
      },
    });
  }, [marketplaceFilterOptions]);
  const marketplaceFilterOptionsSafe = marketplaceFilterOptions ?? {
    beneficiarios: [],
    regiones: [],
    finalidades: [],
    administraciones_convocantes: [],
    tipos_ayuda: [],
  };

  useEffect(() => {
    if (matchesError) {
      console.error('Error al cargar los matches:', matchesError);
      toast.error('Error al cargar los matches');
    }
  }, [matchesError]);

  const filterMatchesByMarketplaceSlugs = (match: Match, filters: MarketplaceFilters) => {
    if (filters.beneficiarios.length > 0) {
      const matchBenef = normalizeLoose(match.beneficiario || match.beneficiarios);
      const beneficiaryMatches = filters.beneficiarios.some((slug) => {
        const token = beneficiariosSlugMap[slug.toLowerCase()] ?? normalizeLoose(slug);
        return matchBenef.includes(token);
      });
      if (!beneficiaryMatches) return false;
    }

    if (filters.finalidades.length > 0) {
      const matchFin = normalizeLoose(match.finalidad);
      const finalidadMatches = filters.finalidades.some((slug) => {
        const token = finalidadesSlugMap[slug.toLowerCase()] ?? normalizeLoose(slug);
        return matchFin.includes(token);
      });
      if (!finalidadMatches) return false;
    }

    if (filters.regiones.length > 0) {
      const matchRegion = normalizeLoose(match.lugar || match.region_impacto);
      const regionMatches = filters.regiones.some((slugWithPrefix) => {
        const slug = slugWithPrefix.includes(':') ? slugWithPrefix.split(':', 2)[1] : slugWithPrefix;
        const token = regionesSlugMap[slug.toLowerCase()] ?? normalizeLoose(slug.replace(/-/g, ' '));
        return matchRegion.includes(token);
      });
      if (!regionMatches) return false;
    }

    if (!includesAny(match.administracion_convocante, filters.administraciones_convocantes)) {
      return false;
    }

    if (!includesAny(match.tipo_ayuda, filters.tipos_ayuda)) {
      return false;
    }

    return true;
  };

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (!amountMatchesRange(match.amount, amountRange)) return false;
      if (!matchDatesWindow(match, dateWindow)) return false;
      if (!filterMatchesByMarketplaceSlugs(match, activeFilters)) return false;
      return true;
    });
  }, [matches, amountRange, dateWindow, activeFilters]);

  const clearAllFilters = () => {
    setActiveFilters(emptyMarketplaceFilters);
    setDraftFilters(emptyMarketplaceFilters);
    setAmountRange(DEFAULT_AMOUNT_RANGE);
    setDraftAmountRange(DEFAULT_AMOUNT_RANGE);
    setDateWindow(DEFAULT_DATE_WINDOW);
    setDraftDateWindow(DEFAULT_DATE_WINDOW);
  };

  const hasActiveAmountFilter =
    amountRange[0] !== AMOUNT_RANGE_MIN || amountRange[1] !== AMOUNT_RANGE_MAX;
  const hasDraftAmountFilter =
    draftAmountRange[0] !== AMOUNT_RANGE_MIN || draftAmountRange[1] !== AMOUNT_RANGE_MAX;
  const hasActiveDateFilter =
    Boolean(dateWindow.fecha_de_inicio) || Boolean(dateWindow.fecha_de_cierre);
  const hasDraftDateFilter =
    Boolean(draftDateWindow.fecha_de_inicio) || Boolean(draftDateWindow.fecha_de_cierre);

  const activeFiltersCount =
    activeFilters.beneficiarios.length +
    activeFilters.regiones.length +
    activeFilters.finalidades.length +
    activeFilters.administraciones_convocantes.length +
    activeFilters.tipos_ayuda.length +
    (hasActiveAmountFilter ? 1 : 0) +
    (hasActiveDateFilter ? 1 : 0);

  const draftFiltersCount =
    draftFilters.beneficiarios.length +
    draftFilters.regiones.length +
    draftFilters.finalidades.length +
    draftFilters.administraciones_convocantes.length +
    draftFilters.tipos_ayuda.length +
    (hasDraftAmountFilter ? 1 : 0) +
    (hasDraftDateFilter ? 1 : 0);

  const openFilters = () => {
    setDraftFilters({
      beneficiarios: [...activeFilters.beneficiarios],
      regiones: [...activeFilters.regiones],
      finalidades: [...activeFilters.finalidades],
      administraciones_convocantes: [...activeFilters.administraciones_convocantes],
      tipos_ayuda: [...activeFilters.tipos_ayuda],
    });
    setDraftAmountRange([amountRange[0], amountRange[1]]);
    setDraftDateWindow({
      fecha_de_inicio: dateWindow.fecha_de_inicio,
      fecha_de_cierre: dateWindow.fecha_de_cierre,
    });
    setShowFiltersSheet(true);
  };

  const applyAndCloseFilters = () => {
    setActiveFilters({
      beneficiarios: [...draftFilters.beneficiarios],
      regiones: [...draftFilters.regiones],
      finalidades: [...draftFilters.finalidades],
      administraciones_convocantes: [...draftFilters.administraciones_convocantes],
      tipos_ayuda: [...draftFilters.tipos_ayuda],
    });
    setAmountRange([draftAmountRange[0], draftAmountRange[1]]);
    setDateWindow({
      fecha_de_inicio: draftDateWindow.fecha_de_inicio,
      fecha_de_cierre: draftDateWindow.fecha_de_cierre,
    });
    setShowFiltersSheet(false);
  };

  const clearDraftFilters = () => {
    setDraftFilters(emptyMarketplaceFilters);
    setDraftAmountRange(DEFAULT_AMOUNT_RANGE);
    setDraftDateWindow(DEFAULT_DATE_WINDOW);
  };

  const updateDraftFilter = (
    filterType: MarketplaceFilterKey,
    value: string
  ) => {
    setDraftFilters((prev) => {
      if (
        filterType !== 'beneficiarios' &&
        filterType !== 'regiones' &&
        filterType !== 'finalidades' &&
        filterType !== 'administraciones_convocantes' &&
        filterType !== 'tipos_ayuda'
      ) {
        return prev;
      }
      const currentValues = prev[filterType];
      const isSelected = currentValues.includes(value);
      return {
        ...prev,
        [filterType]: isSelected
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value],
      };
    });
  };

  const downloadVisibleMatchesExcel = async () => {
    if (!filteredMatches.length) {
      toast.error('No hay subvenciones en pantalla para exportar');
      return;
    }

    setIsExportingExcel(true);
    try {
      const response = await fetch(`${apiUrl}/api/matches/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          grant_ids: filteredMatches.map((match) => match.grant_id),
          filters_applied: {
            amountRange,
            dateWindow,
            beneficiarios: activeFilters.beneficiarios,
            regiones: activeFilters.regiones,
            finalidades: activeFilters.finalidades,
            administraciones_convocantes: activeFilters.administraciones_convocantes,
            tipos_ayuda: activeFilters.tipos_ayuda,
          },
        }),
      });

      if (!response.ok) {
        let errorMessage = 'No se pudo generar el Excel';
        try {
          const data = await response.json();
          errorMessage = data?.error || errorMessage;
        } catch {
          // ignore json parse errors
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      const rawFilename = filenameMatch?.[1] ?? 'subvenciones_compatibles.xlsx';
      const filename = decodeURIComponent(rawFilename.replace(/"/g, ''));

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Excel descargado correctamente');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Error al descargar el Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background md:pl-20">
      <main
        className="flex-1 pt-6 md:pt-10 pb-20 md:pb-16 px-2 md:px-4 flex flex-col items-center"
        style={{ paddingRight: '50px' }}
      >

        <div className="w-full bg-primary/5 dark:bg-card border border-primary/10 dark:border-primary/20 rounded-xl p-4 md:p-6 mb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg md:text-xl font-bold">Subvenciones Compatibles</h2>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Aquí ves las subvenciones que mejor encajan con tu empresa según el perfil que has
                completado (actividad, tamaño, características y necesidades).
              </p>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Usa los filtros para acotar resultados según el tipo de ayuda que te interese en este momento.
              </p>
            </div>
          </div>
        </div>

        <Card className="w-full p-4 md:p-5 mb-6 border-border/60">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm md:text-base">Filtrar subvenciones compatibles</h3>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {activeFiltersCount} filtros activos
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openFilters}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  {activeFiltersCount > 0 ? 'Editar filtros' : 'Abrir filtros'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={downloadVisibleMatchesExcel}
                  disabled={isLoadingMatches || isExportingExcel || filteredMatches.length === 0}
                >
                  {isExportingExcel ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Descargar Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  disabled={activeFiltersCount === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasActiveAmountFilter && (
                <Badge variant="outline" className="text-xs">
                  Importe: {formatEuroRangeValue(amountRange[0])} - {formatEuroRangeValue(amountRange[1])}
                </Badge>
              )}
              {hasActiveDateFilter && (
                <Badge variant="outline" className="text-xs">
                  Fechas: inicio {formatIsoDateForBadge(dateWindow.fecha_de_inicio)} · cierre {formatIsoDateForBadge(dateWindow.fecha_de_cierre)}
                </Badge>
              )}
              {activeFilters.beneficiarios.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Beneficiarios: {activeFilters.beneficiarios.length}
                </Badge>
              )}
              {activeFilters.regiones.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Regiones: {activeFilters.regiones.length}
                </Badge>
              )}
              {activeFilters.finalidades.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Finalidades: {activeFilters.finalidades.length}
                </Badge>
              )}
              {activeFilters.administraciones_convocantes.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Admin. convocante: {activeFilters.administraciones_convocantes.length}
                </Badge>
              )}
              {activeFilters.tipos_ayuda.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Tipo ayuda: {activeFilters.tipos_ayuda.length}
                </Badge>
              )}
              {activeFiltersCount === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sin filtros activos. Pulsa en "Abrir filtros" para filtrar como en el marketplace.
                </p>
              )}
            </div>

          </div>
        </Card>

        {isLoadingMatches ? (
          <div className="w-full flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : filteredMatches.length > 0 ? (
          <div className="w-full">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-sm text-muted-foreground">
                Mostrando <span className="font-medium text-foreground">{filteredMatches.length}</span> de{' '}
                <span className="font-medium text-foreground">{matches.length}</span> matches
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 items-start">
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.grant_id}
                  title={match.title}
                  amount={match.amount}
                  deadline={match.deadline}
                  justificacion={match.justificacion}
                  resumen_completo={match.resumen}
                  beneficiario={match.beneficiario}
                  lugar={match.lugar}
                  finalidad={match.finalidad}
                  queRecibeBeneficiario={match.importe_beneficiario}
                  numero_match={match.numero_match}
                  grant_id={match.grant_id}
                />
              ))}
            </div>
          </div>
        ) : matches.length > 0 ? (
          <Card className="w-full p-8 text-center">
            <p className="text-muted-foreground mb-2">No hay matches con esos filtros</p>
            <p className="text-sm text-muted-foreground mb-6">
              Ajusta los filtros para ampliar los resultados.
            </p>
            <Button variant="outline" onClick={clearAllFilters}>
              Limpiar filtros
            </Button>
          </Card>
        ) : (
          <Card className="w-full p-8 text-center">
            <p className="text-muted-foreground mb-4">Aún no tienes subvenciones compatibles</p>
            <p className="text-sm text-muted-foreground mb-6">
              Si completas mejor los
              datos de tu empresa, podremos recomendarte subvenciones más precisas. ¡Ve a tu perfil y añádelos para empezar a recibir recomendaciones personalizadas!
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link to="/entities">
                <Button>Completar perfil</Button>
              </Link>
            </div>
          </Card>
        )}
      </main>

      <Sheet open={showFiltersSheet} onOpenChange={setShowFiltersSheet}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle>Filtros de Subvenciones Compatibles</SheetTitle>
            <SheetDescription>
              Usa los mismos filtros del marketplace y pulsa en guardar para aplicar y cerrar.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0">
            <MarketplaceSidebar
              filters={draftFilters}
              onFilterChange={updateDraftFilter}
              onClearFilters={clearDraftFilters}
              hasActiveFilters={draftFiltersCount > 0}
              filterOptions={marketplaceFilterOptionsSafe}
              amountFilter={{
                min: AMOUNT_RANGE_MIN,
                max: AMOUNT_RANGE_MAX,
                value: draftAmountRange,
                step: 100_000,
                hasActive: hasDraftAmountFilter,
                formatValue: formatEuroRangeValue,
                onChange: setDraftAmountRange,
                onReset: () => setDraftAmountRange(DEFAULT_AMOUNT_RANGE),
              }}
              dateFilter={{
                startDate: draftDateWindow.fecha_de_inicio,
                endDate: draftDateWindow.fecha_de_cierre,
                hasActive: hasDraftDateFilter,
                onStartDateChange: (value) =>
                  setDraftDateWindow((prev) => ({ ...prev, fecha_de_inicio: value })),
                onEndDateChange: (value) =>
                  setDraftDateWindow((prev) => ({ ...prev, fecha_de_cierre: value })),
                onReset: () => setDraftDateWindow(DEFAULT_DATE_WINDOW),
              }}
            />
          </div>

          <SheetFooter className="px-4 py-4 border-t gap-2">
            <Button variant="ghost" onClick={() => setShowFiltersSheet(false)}>
              Cerrar
            </Button>
            <Button variant="outline" onClick={clearDraftFilters} disabled={draftFiltersCount === 0}>
              Limpiar
            </Button>
            <Button onClick={applyAndCloseFilters}>
              Guardar filtros
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Matches;
