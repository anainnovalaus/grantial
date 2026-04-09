import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Building2, Landmark, Loader2, MapPin, SlidersHorizontal, Sparkles, Heart, Bell, Search, Tag, Target, Trash2, X, Play } from 'lucide-react';
import GrantCard from '@/components/GrantCard';
import { MarketplaceSidebar, type FilterOption, type MarketplaceFilterKey } from '@/components/marketplace/MarketplaceSidebar';
import { MarketplaceSearch } from '@/components/marketplace/MarketplaceSearch';
import { useMarketplaceFilters } from '@/hooks/useMarketplaceFilters';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { Button } from '@/components/ui/button';
import { cn, formatAmount } from '@/lib/utils';
import { trackRecoEvent } from '@/lib/recoEvents';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Grant {
  grant_id: string;
  titulo_corto: string;
  presupuesto: string;
  importe_beneficiario?: string;
  fecha_limite: string;
  resumen: string;
  beneficiarios?: string;
  region_impacto?: string;
  finalidad?: string;
  numero_match?: number;
}

interface FavoriteGrant {
  grant_id: number;
  titulo_corto: string;
  presupuesto: string;
  fecha_limite: string;
  resumen: string;
  beneficiarios: string;
  region_impacto: string;
  favorited_at: string | null;
  numero_match?: number | null;
}

interface Alert {
  id: number;
  alert_name: string;
  filters: {
    beneficiarios: string[];
    regiones: string[];
    finalidades: string[];
    administraciones_convocantes?: string[];
    tipos_ayuda?: string[];
  };
  created_at: string | null;
  is_active: boolean;
}

interface GrantsResponse {
  grants: Grant[];
  page: number;
  total_pages: number;
  has_more: boolean;
  total_count: number;
}

interface MarketplaceFiltersState {
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

type AlertFilterCategory = keyof MarketplaceFiltersState;
type MarketplaceOrderMode = 'preferences' | 'match' | 'amount' | 'deadline';
type MarketplaceSortDirection = 'asc' | 'desc';

const AMOUNT_RANGE_MIN = 0;
const AMOUNT_RANGE_MAX = 50_000_000;
const DEFAULT_AMOUNT_RANGE: [number, number] = [AMOUNT_RANGE_MIN, AMOUNT_RANGE_MAX];
const DEFAULT_DATE_WINDOW: DateWindowFilter = { fecha_de_inicio: '', fecha_de_cierre: '' };
const MARKETPLACE_ORDER_OPTIONS: Array<{ value: MarketplaceOrderMode; label: string; description: string }> = [
  { value: 'preferences', label: 'Preferencias', description: 'Prioriza las subvenciones que mejor encajan contigo.' },
  { value: 'match', label: 'Match', description: 'Ordena por compatibilidad con tu entidad.' },
  { value: 'amount', label: 'Importe', description: 'Ordena por mayor importe de subvención.' },
  { value: 'deadline', label: 'Plazo', description: 'Ordena por cierre más próximo.' },
];
const MARKETPLACE_DIRECTION_OPTIONS: Array<{ value: MarketplaceSortDirection; label: string; description: string }> = [
  { value: 'desc', label: 'Descendente', description: 'De mayor a menor prioridad o valor.' },
  { value: 'asc', label: 'Ascendente', description: 'De menor a mayor prioridad o valor.' },
];

const parseGrantBudgetToNumber = (raw?: string): number | null => {
  if (!raw) return null;

  const matches = raw.match(/\d[\d.,]*/g);
  if (!matches?.length) return null;

  const candidates = matches
    .map((token) => {
      const cleaned = token.replace(/\./g, '').replace(',', '.');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value): value is number => value !== null);

  if (!candidates.length) return null;
  return Math.max(...candidates);
};

const formatEuroRangeValue = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);

const formatIsoDateForBadge = (value?: string) => {
  if (!value) return 'Sin filtro';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const normalizeLooseText = (value?: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const slugifyLoose = (value?: string) =>
  normalizeLooseText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const LEGACY_ALERT_HINTS: Partial<Record<AlertFilterCategory, Record<string, string[]>>> = {
  beneficiarios: {
    'entidad-sin-animo-de-lucro': ['entidad (sin animo lucro)', 'entidad sin animo lucro'],
    'gran-empresa': ['gran empresa'],
  },
  finalidades: {
    'acceso-vivienda': ['acceso a la vivienda'],
    'comercio-turismo-pymes': ['comercio', 'turismo', 'pymes'],
    'fomento-empleo': ['fomento del empleo'],
    'industria-energia': ['industria', 'energia'],
    'investigacion-desarrollo-innovacion': ['investigacion', 'innovacion'],
    'otras-actuaciones-economicas': ['otras actuaciones', 'caracter economico'],
    'otras-prestaciones-economicas': ['otras prestaciones'],
    'subvenciones-transporte': ['transporte'],
  },
};

const mapAlertValuesToCurrentOptions = (
  values: string[] | undefined,
  options: FilterOption[],
  category: AlertFilterCategory,
) => {
  if (!Array.isArray(values) || values.length === 0) return [];

  const uniqueResolved: string[] = [];
  const pushUnique = (value: string) => {
    if (!value) return;
    if (!uniqueResolved.includes(value)) uniqueResolved.push(value);
  };

  const optionRecords = options.map((option) => ({
    option,
    normValue: normalizeLooseText(option.value),
    normLabel: normalizeLooseText(option.label),
    slugValue: slugifyLoose(option.value),
    slugLabel: slugifyLoose(option.label),
  }));

  values.forEach((rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return;

    const exactMatch = optionRecords.find(
      ({ option }) => option.value === raw || option.label === raw
    );
    if (exactMatch) {
      pushUnique(exactMatch.option.value);
      return;
    }

    const normRaw = normalizeLooseText(raw);
    const looseMatch = optionRecords.find(
      ({ normValue, normLabel }) => normValue === normRaw || normLabel === normRaw
    );
    if (looseMatch) {
      pushUnique(looseMatch.option.value);
      return;
    }

    const rawNoPrefix = raw.includes(':') ? raw.split(':', 2)[1] : raw;
    const rawSlug = slugifyLoose(rawNoPrefix);
    const slugMatch = optionRecords.find(
      ({ slugValue, slugLabel }) => slugValue === rawSlug || slugLabel === rawSlug
    );
    if (slugMatch) {
      pushUnique(slugMatch.option.value);
      return;
    }

    const hints = LEGACY_ALERT_HINTS[category]?.[raw] ?? [];
    if (hints.length > 0) {
      const normalizedHints = hints.map((hint) => normalizeLooseText(hint));
      const hintMatch = optionRecords.find(({ normValue, normLabel }) =>
        normalizedHints.some((hint) => normValue.includes(hint) || normLabel.includes(hint))
      );
      if (hintMatch) {
        pushUnique(hintMatch.option.value);
        return;
      }
    }

    // Fallback: conservar el valor original para no romper el filtrado backend
    pushUnique(raw);
  });

  return uniqueResolved;
};

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

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

const fetchMarketplaceGrants = async ({
  pageParam = 1,
  filters,
  searchQuery,
  orderBy,
  sortDirection,
  amountRange,
  dateRange,
}: {
  pageParam?: number;
  filters: MarketplaceFiltersState;
  searchQuery: string;
  orderBy: MarketplaceOrderMode;
  sortDirection: MarketplaceSortDirection;
  amountRange: [number, number];
  dateRange: DateWindowFilter;
}): Promise<GrantsResponse> => {
  const requestBody = {
    page: pageParam,
    filters: {
      beneficiarios: filters.beneficiarios,
      regiones: filters.regiones,
      finalidades: filters.finalidades,
      administraciones_convocantes: filters.administraciones_convocantes,
      tipos_ayuda: filters.tipos_ayuda,
    },
    search_query: searchQuery,
    order_by: orderBy,
    sort_direction: sortDirection,
    amount_range: amountRange,
    date_range: dateRange,
  };

  console.log('🚀 FETCHING MARKETPLACE GRANTS:', {
    page: pageParam,
    orderBy: orderBy,
    sortDirection,
    filters: filters,
    searchQuery: searchQuery,
    dateRange,
  });

  const doRequest = () => fetch(`${import.meta.env.VITE_API_URL}/api/search_grants_marketplace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  let response = await doRequest();

  // Reintento único para ventanas cortas de rate limit (p.ej. cooldown local de 5s).
  if (response.status === 429) {
    const waitMs = await parseRateLimitWaitMs(response);
    await sleep(waitMs);
    response = await doRequest();
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const concise = bodyText ? bodyText.slice(0, 280) : '';
    console.error('Marketplace search failed', {
      status: response.status,
      statusText: response.statusText,
      body: concise,
      requestBody,
    });
    if (response.status === 429) {
      throw new Error('Demasiadas solicitudes. Espera unos segundos y vuelve a filtrar.');
    }
    throw new Error(`Error al cargar las subvenciones (${response.status})`);
  }

  const result = await response.json();
  console.log('✅ RECEIVED GRANTS:', {
    count: result.grants?.length,
    page: result.page,
    orderBy: orderBy
  });

  return result;
};

const fetchMarketplaceFilterOptions = async (): Promise<MarketplaceFilterOptionsResponse> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_filter_options`);
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
      .filter((item): item is FilterOption => item !== null);
  };

  return {
    beneficiarios: normalizeOptions(data?.beneficiarios),
    regiones: normalizeOptions(data?.regiones),
    finalidades: normalizeOptions(data?.finalidades),
    administraciones_convocantes: normalizeOptions(data?.administraciones_convocantes),
    tipos_ayuda: normalizeOptions(data?.tipos_ayuda),
  };
};

const GrantMarketplace: React.FC = () => {
  const navigate = useNavigate();
  const { filters, updateFilter, clearFilters, hasActiveFilters } = useMarketplaceFilters();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [orderByMode, setOrderByMode] = useState<MarketplaceOrderMode>('preferences');
  const [sortDirection, setSortDirection] = useState<MarketplaceSortDirection>('desc');
  const [amountRange, setAmountRange] = useState<[number, number]>(DEFAULT_AMOUNT_RANGE);
  const [dateRange, setDateRange] = useState<DateWindowFilter>(DEFAULT_DATE_WINDOW);
  const impressedMarketplaceIdsRef = useRef<Set<string>>(new Set());

  // Favorites state
  const [showFavoritesDialog, setShowFavoritesDialog] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteGrant[]>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // Alerts state
  const [showAlertsDialog, setShowAlertsDialog] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const [alertName, setAlertName] = useState('');

  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const { data: marketplaceFilterOptions } = useQuery({
    queryKey: ['marketplaceFilterOptions'],
    queryFn: fetchMarketplaceFilterOptions,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!marketplaceFilterOptions) return;
    console.log('🧩 Marketplace filter options loaded', {
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

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['marketplaceGrants', filters, debouncedSearchQuery, orderByMode, sortDirection, amountRange, dateRange],
    queryFn: ({ pageParam = 1 }) =>
      fetchMarketplaceGrants({
        pageParam,
        filters,
        searchQuery: debouncedSearchQuery,
        orderBy: orderByMode,
        sortDirection,
        amountRange,
        dateRange,
      }),
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch favorites count on mount
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/favorites`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (response.ok) {
          const data = await response.json();
          setFavoritesCount(data.count);
        }
      } catch (e) { /* silent */ }
    };
    fetchCount();
  }, []);

  // Fetch favorites when dialog opens
  useEffect(() => {
    if (showFavoritesDialog) {
      fetchFavorites();
    }
  }, [showFavoritesDialog]);

  // Fetch alerts when dialog opens
  useEffect(() => {
    if (showAlertsDialog) {
      fetchAlerts();
    }
  }, [showAlertsDialog]);

  // Fetch alerts count on mount
  useEffect(() => {
    const fetchAlertsCount = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/alerts`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (response.ok) {
          const data = await response.json();
          setAlertsCount(typeof data.count === 'number' ? data.count : (Array.isArray(data.alerts) ? data.alerts.length : 0));
        }
      } catch (e) { /* silent */ }
    };
    fetchAlertsCount();
  }, []);

  // Accumulate all grants from all pages
  const grants = data?.pages.flatMap(page => page.grants) ?? [];
  // El filtro de importe ya se aplica en backend para mantener paginación y conteo consistentes.
  const filteredGrantsByAmount = grants;
  const totalCount = data?.pages[0]?.total_count ?? 0;
  const hasActiveAmountFilter =
    amountRange[0] !== AMOUNT_RANGE_MIN || amountRange[1] !== AMOUNT_RANGE_MAX;
  const hasActiveDateFilter =
    Boolean(dateRange.fecha_de_inicio) || Boolean(dateRange.fecha_de_cierre);

  // Infinite scroll hook
  const observerTarget = useInfiniteScroll({
    onLoadMore: fetchNextPage,
    hasMore: hasNextPage ?? false,
    isLoading: isFetchingNextPage,
  });

  const handleFilterChange = (
    filterType: MarketplaceFilterKey,
    value: string
  ) => {
    updateFilter(filterType, value);
    setIsMobileFilterOpen(false);
  };

  useEffect(() => {
    if (!filteredGrantsByAmount.length) return;

    filteredGrantsByAmount.slice(0, 12).forEach((grant, index) => {
      const grantId = String(grant.grant_id);
      if (!grantId || impressedMarketplaceIdsRef.current.has(grantId)) return;

      impressedMarketplaceIdsRef.current.add(grantId);
      void trackRecoEvent({
        eventType: 'impression',
        grantId,
        surface: 'marketplace',
        position: index + 1,
        metadata: { source: 'GrantMarketplace' },
      });
    });
  }, [filteredGrantsByAmount]);

  const handleClearFilters = () => {
    clearFilters();
    setSearchQuery('');
    setAmountRange(DEFAULT_AMOUNT_RANGE);
    setDateRange(DEFAULT_DATE_WINDOW);
  };

  // ---- Favorites functions ----
  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/favorites`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites);
        setFavoritesCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setFavoritesLoading(false);
    }
  };

  const removeFavorite = async (grantId: string | number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/favorites/remove`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ grant_id: grantId })
      });
      if (response.ok) {
        toast.success('Favorito eliminado');
        fetchFavorites();
      }
    } catch (error) {
      toast.error('Error al eliminar favorito');
    }
  };

  // ---- Alerts functions ----
  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/alerts`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts);
        setAlertsCount(typeof data.count === 'number' ? data.count : (Array.isArray(data.alerts) ? data.alerts.length : 0));
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const saveAlert = async () => {
    const name = alertName.trim() || 'Mi alerta';
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/alerts/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert_name: name,
          filters: filters
        })
      });
      if (response.ok) {
        toast.success('Alerta guardada correctamente');
        setAlertName('');
        fetchAlerts();
      }
    } catch (error) {
      toast.error('Error al guardar la alerta');
    }
  };

  const deleteAlert = async (alertId: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (response.ok) {
        toast.success('Alerta eliminada');
        fetchAlerts();
      }
    } catch (error) {
      toast.error('Error al eliminar la alerta');
    }
  };

  const applyAlertFilters = (alertFilters: Alert['filters']) => {
    const normalizedAlertFilters = {
      beneficiarios: mapAlertValuesToCurrentOptions(
        alertFilters.beneficiarios,
        marketplaceFilterOptionsSafe.beneficiarios,
        'beneficiarios'
      ),
      regiones: mapAlertValuesToCurrentOptions(
        alertFilters.regiones,
        marketplaceFilterOptionsSafe.regiones,
        'regiones'
      ),
      finalidades: mapAlertValuesToCurrentOptions(
        alertFilters.finalidades,
        marketplaceFilterOptionsSafe.finalidades,
        'finalidades'
      ),
      administraciones_convocantes: mapAlertValuesToCurrentOptions(
        alertFilters.administraciones_convocantes,
        marketplaceFilterOptionsSafe.administraciones_convocantes,
        'administraciones_convocantes'
      ),
      tipos_ayuda: mapAlertValuesToCurrentOptions(
        alertFilters.tipos_ayuda,
        marketplaceFilterOptionsSafe.tipos_ayuda,
        'tipos_ayuda'
      ),
    };

    console.log('🔔 Applying alert filters (normalized)', {
      original: alertFilters,
      normalized: normalizedAlertFilters,
    });

    clearFilters();
    setTimeout(() => {
      if (normalizedAlertFilters.beneficiarios) {
        normalizedAlertFilters.beneficiarios.forEach((v: string) => updateFilter('beneficiarios', v));
      }
      if (normalizedAlertFilters.regiones) {
        normalizedAlertFilters.regiones.forEach((v: string) => updateFilter('regiones', v));
      }
      if (normalizedAlertFilters.finalidades) {
        normalizedAlertFilters.finalidades.forEach((v: string) => updateFilter('finalidades', v));
      }
      if (normalizedAlertFilters.administraciones_convocantes) {
        normalizedAlertFilters.administraciones_convocantes.forEach((v: string) => updateFilter('administraciones_convocantes', v));
      }
      if (normalizedAlertFilters.tipos_ayuda) {
        normalizedAlertFilters.tipos_ayuda.forEach((v: string) => updateFilter('tipos_ayuda', v));
      }
      setShowAlertsDialog(false);
      toast.success('Filtros de alerta aplicados');
    }, 0);
  };

  return (
    <div className="min-h-screen bg-background md:pl-20">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-80 sticky top-0 h-screen">
          <MarketplaceSidebar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters || searchQuery.length > 0}
            filterOptions={marketplaceFilterOptionsSafe}
            amountFilter={{
                min: AMOUNT_RANGE_MIN,
                max: AMOUNT_RANGE_MAX,
                value: amountRange,
                step: 100_000,
                hasActive: hasActiveAmountFilter,
                formatValue: formatEuroRangeValue,
                onChange: setAmountRange,
                onReset: () => setAmountRange(DEFAULT_AMOUNT_RANGE),
              }}
            dateFilter={{
              startDate: dateRange.fecha_de_inicio,
              endDate: dateRange.fecha_de_cierre,
              hasActive: hasActiveDateFilter,
              onStartDateChange: (value) =>
                setDateRange((prev) => ({ ...prev, fecha_de_inicio: value })),
              onEndDateChange: (value) =>
                setDateRange((prev) => ({ ...prev, fecha_de_cierre: value })),
              onReset: () => setDateRange(DEFAULT_DATE_WINDOW),
            }}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Mobile Filter Button */}
            <div className="lg:hidden mb-4">
              <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtros
                    {(hasActiveFilters || searchQuery.length > 0 || hasActiveAmountFilter || hasActiveDateFilter) && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        {(filters?.beneficiarios?.length || 0) +
                          (filters?.regiones?.length || 0) +
                          (filters?.finalidades?.length || 0) +
                          (filters?.administraciones_convocantes?.length || 0) +
                          (filters?.tipos_ayuda?.length || 0) +
                          (hasActiveAmountFilter ? 1 : 0) +
                          (hasActiveDateFilter ? 1 : 0)}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="h-[calc(100vh-5rem)] overflow-y-auto">
                    <MarketplaceSidebar
                      filters={filters}
                      onFilterChange={handleFilterChange}
                      onClearFilters={handleClearFilters}
                      hasActiveFilters={hasActiveFilters || searchQuery.length > 0}
                      filterOptions={marketplaceFilterOptionsSafe}
                      amountFilter={{
                        min: AMOUNT_RANGE_MIN,
                        max: AMOUNT_RANGE_MAX,
                        value: amountRange,
                        step: 100_000,
                        hasActive: hasActiveAmountFilter,
                        formatValue: formatEuroRangeValue,
                        onChange: setAmountRange,
                        onReset: () => setAmountRange(DEFAULT_AMOUNT_RANGE),
                      }}
                      dateFilter={{
                        startDate: dateRange.fecha_de_inicio,
                        endDate: dateRange.fecha_de_cierre,
                        hasActive: hasActiveDateFilter,
                        onStartDateChange: (value) =>
                          setDateRange((prev) => ({ ...prev, fecha_de_inicio: value })),
                        onEndDateChange: (value) =>
                          setDateRange((prev) => ({ ...prev, fecha_de_cierre: value })),
                        onReset: () => setDateRange(DEFAULT_DATE_WINDOW),
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Search Bar and Action Buttons */}
            <div className="mb-8 space-y-4">
              <MarketplaceSearch
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                resultsCount={totalCount}
                isLoading={isLoading}
                orderByMode={orderByMode}
                sortDirection={sortDirection}
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
                <Button
                  onClick={() => navigate('/subvenciones-compatibles')}
                  variant="tramitar"
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Ver Compatibles (+80%)
                </Button>

                <Button
                  onClick={() => setShowFavoritesDialog(true)}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Favoritos
                  {favoritesCount > 0 && (
                    <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      {favoritesCount}
                    </span>
                  )}
                </Button>

                <Button
                  onClick={() => setShowAlertsDialog(true)}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Guardar alerta
                  {alertsCount > 0 && (
                    <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      {alertsCount}
                    </span>
                  )}
                </Button>

                <div className="w-full sm:w-auto sm:ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto cursor-pointer justify-between gap-2"
                      >
                        <span className="inline-flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4" />
                          Ordenar
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {MARKETPLACE_ORDER_OPTIONS.find((option) => option.value === orderByMode)?.label} · {sortDirection === 'desc' ? 'Desc' : 'Asc'}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Ordenar subvenciones</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={orderByMode}
                        onValueChange={(value) => setOrderByMode(value as MarketplaceOrderMode)}
                      >
                        {MARKETPLACE_ORDER_OPTIONS.map((option) => (
                          <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                            className="cursor-pointer items-start"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.description}</span>
                            </div>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Sentido</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={sortDirection}
                        onValueChange={(value) => setSortDirection(value as MarketplaceSortDirection)}
                      >
                        {MARKETPLACE_DIRECTION_OPTIONS.map((option) => (
                          <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                            className="cursor-pointer items-start"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.description}</span>
                            </div>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {hasActiveDateFilter && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    Fechas: inicio {formatIsoDateForBadge(dateRange.fecha_de_inicio)} · cierre {formatIsoDateForBadge(dateRange.fecha_de_cierre)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Error State */}
            {isError && (
              <div className="text-center py-12">
                <p className="text-destructive">Error al cargar las subvenciones</p>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && filteredGrantsByAmount.length === 0 && !hasNextPage && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No se encontraron subvenciones con los filtros seleccionados
                </p>
                {(hasActiveFilters || searchQuery.length > 0 || hasActiveAmountFilter || hasActiveDateFilter) && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            )}

            {/* Grants Grid */}
            {!isLoading && !isError && filteredGrantsByAmount.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {filteredGrantsByAmount.map((grant) => (
                  <GrantCard
                    key={grant.grant_id}
                    grant_id={grant.grant_id}
                    title={grant.titulo_corto || ''}
                    amount={grant.presupuesto || ''}
                    deadline={grant.fecha_limite || ''}
                    description={grant.resumen || ''}
                    beneficiario={grant.beneficiarios}
                    lugar={grant.region_impacto}
                    finalidad={grant.finalidad}
                    queRecibeBeneficiario={grant.importe_beneficiario}
                    matchPercentage={grant.numero_match}
                    showMatchBadge={true}
                  />
                ))}
              </div>
            )}

            {/* Loading more indicator */}
            {isFetchingNextPage && (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {/* Infinite scroll observer target */}
            {!isLoading && !isError && (filteredGrantsByAmount.length > 0 || (grants.length > 0 && !!hasNextPage)) && (
              <div ref={observerTarget} className="h-10" />
            )}
          </div>
        </main>
      </div>

      {/* Favorites Dialog */}
      <Dialog open={showFavoritesDialog} onOpenChange={setShowFavoritesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Mis Favoritos</DialogTitle>
            <DialogDescription>
              Subvenciones que has guardado como favoritas
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {favoritesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : favorites.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No tienes favoritos guardados
              </p>
            ) : (
              <div className="space-y-3">
                {favorites.map((fav) => (
                  <Card key={fav.grant_id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4
                          className="font-medium text-sm cursor-pointer hover:text-primary truncate"
                          onClick={() => {
                            setShowFavoritesDialog(false);
                            navigate(`/grants/${fav.grant_id}`);
                          }}
                        >
                          {fav.titulo_corto}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Match: {typeof fav.numero_match === 'number' ? `${fav.numero_match}%` : 'No disponible'}</span>
                          <span>Fondos: {fav.presupuesto || 'No disponible'}</span>
                          <span>Plazo: {fav.fecha_limite || 'No disponible'}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeFavorite(fav.grant_id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Alerts Dialog */}
      <Dialog open={showAlertsDialog} onOpenChange={setShowAlertsDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Mis Alertas{alertsCount > 0 ? ` (${alertsCount})` : ''}
            </DialogTitle>
            <DialogDescription>
              Guarda combinaciones de filtros como alertas y aplícalas con un clic para buscar subvenciones.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0 md:gap-6 overflow-hidden">
            {/* ── Left column: Create new alert ── */}
            <div className="border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4 overflow-y-auto">
              <div className="space-y-4 py-2">
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Guardar filtros actuales</p>
                  {hasActiveFilters ? (
                    <div className="space-y-3">
                      {/* Current filters as chips */}
                      <div className="space-y-2">
                        {([
                          { key: 'beneficiarios', label: 'Beneficiarios', icon: Building2, values: filters.beneficiarios },
                          { key: 'regiones', label: 'Regiones', icon: MapPin, values: filters.regiones },
                          { key: 'finalidades', label: 'Finalidades', icon: Target, values: filters.finalidades },
                          { key: 'administraciones_convocantes', label: 'Admin.', icon: Landmark, values: filters.administraciones_convocantes || [] },
                          { key: 'tipos_ayuda', label: 'Tipo ayuda', icon: Tag, values: filters.tipos_ayuda || [] },
                        ] as const).filter(c => c.values.length > 0).map((cat) => {
                          const CatIcon = cat.icon;
                          return (
                            <div key={cat.key}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <CatIcon className="h-3 w-3 text-muted-foreground" />
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{cat.label}</p>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {cat.values.map((val) => (
                                  <span
                                    key={val}
                                    className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-700"
                                  >
                                    <span className="max-w-[100px] truncate">{val}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Name input + save button */}
                      <div className="space-y-2">
                        <Input
                          placeholder="Nombre de la alerta (opcional)"
                          value={alertName}
                          onChange={(e) => setAlertName(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Button onClick={saveAlert} size="sm" className="w-full">
                          <Bell className="h-3.5 w-3.5 mr-2" />
                          Guardar alerta
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground text-center">
                        Selecciona filtros en el marketplace para guardar una alerta.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column: Saved alerts ── */}
            <ScrollArea className="flex-1 min-h-0 pr-2">
              <div className="py-2">
                <p className="text-xs font-semibold text-foreground mb-3">Alertas guardadas</p>

                {alertsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="rounded-lg bg-muted/40 p-6 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No tienes alertas guardadas</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Aplica filtros y guárdalos como alerta para encontrarlos rápido.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => {
                      const alertFilterCategories = [
                        { key: 'beneficiarios', label: 'Beneficiarios', icon: Building2, values: alert.filters.beneficiarios || [] },
                        { key: 'regiones', label: 'Regiones', icon: MapPin, values: alert.filters.regiones || [] },
                        { key: 'finalidades', label: 'Finalidades', icon: Target, values: alert.filters.finalidades || [] },
                        { key: 'administraciones_convocantes', label: 'Admin. convocante', icon: Landmark, values: alert.filters.administraciones_convocantes || [] },
                        { key: 'tipos_ayuda', label: 'Tipo de ayuda', icon: Tag, values: alert.filters.tipos_ayuda || [] },
                      ].filter(c => c.values.length > 0);

                      return (
                        <div
                          key={alert.id}
                          className="rounded-xl border border-border p-4 space-y-3 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                        >
                          {/* Alert header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                                <Bell className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-medium text-sm truncate">{alert.alert_name}</h5>
                                {alert.created_at && (
                                  <p className="text-[10px] text-muted-foreground/60">
                                    {new Date(alert.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-xs px-3 bg-violet-600 hover:bg-violet-700 text-white"
                                onClick={() => applyAlertFilters(alert.filters)}
                              >
                                <Play className="h-3 w-3 mr-1.5 fill-current" />
                                Aplicar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteAlert(alert.id)}
                                title="Eliminar alerta"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Alert filter chips */}
                          {alertFilterCategories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {alertFilterCategories.map((cat) =>
                                cat.values.map((val) => {
                                  const CatIcon = cat.icon;
                                  return (
                                    <span
                                      key={`${cat.key}-${val}`}
                                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-foreground border border-border"
                                    >
                                      <CatIcon className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                                      <span className="max-w-[120px] truncate">{val}</span>
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrantMarketplace;
