import React from 'react';
import { Building2, CalendarDays, Coins, Landmark, MapPin, Tag, Target, X } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

export interface FilterOption {
  value: string;
  label: string;
}

export type MarketplaceFilterKey =
  | 'beneficiarios'
  | 'regiones'
  | 'finalidades'
  | 'administraciones_convocantes'
  | 'tipos_ayuda';

interface MarketplaceSidebarProps {
  filters: {
    beneficiarios: string[];
    regiones: string[];
    finalidades: string[];
    administraciones_convocantes?: string[];
    tipos_ayuda?: string[];
  };
  onFilterChange: (filterType: MarketplaceFilterKey, value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  filterOptions?: {
    beneficiarios?: FilterOption[];
    regiones?: FilterOption[];
    finalidades?: FilterOption[];
    administraciones_convocantes?: FilterOption[];
    tipos_ayuda?: FilterOption[];
  };
  amountFilter?: {
    min: number;
    max: number;
    value: [number, number];
    step?: number;
    hasActive: boolean;
    formatValue: (value: number) => string;
    onChange: (value: [number, number]) => void;
    onReset: () => void;
  };
  dateFilter?: {
    startDate: string;
    endDate: string;
    hasActive: boolean;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onReset: () => void;
  };
}

export interface RegionGroup {
  ccaa: FilterOption;
  items: FilterOption[];
}

// Utilidad de ordenación alfabética (ES)
const byLabelEs = (a: FilterOption, b: FilterOption) =>
  a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });

const optionCheckboxId = (prefix: string, value: string) =>
  `${prefix}-${value}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const normalizeRegionGroupKey = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const REGION_CCAA_ALIASES: Record<string, string[]> = {
  'Islas Baleares': ['Illes Balears', 'Islas Baleares'],
  'Principado de Asturias': ['Principado de Asturias', 'Asturias'],
  'Comunidad Valenciana': ['Comunitat Valenciana', 'Comunidad Valenciana'],
  'Comunidad Foral de Navarra': ['Comunidad Foral de Navarra', 'Navarra'],
  'País Vasco': ['País Vasco', 'Euskadi'],
};

export interface GroupedRegionOptionGroup {
  groupLabel: string;
  ccaaOption?: FilterOption;
  provinces: FilterOption[];
}

export interface GroupedRegionOptionsResult {
  groups: GroupedRegionOptionGroup[];
  ungrouped: FilterOption[];
}

export const groupRegionOptions = (options: FilterOption[]): GroupedRegionOptionsResult => {
  const optionByKey = new Map<string, FilterOption[]>();
  const matchedValues = new Set<string>();

  options.forEach((option) => {
    const key = normalizeRegionGroupKey(option.label || option.value);
    if (!key) return;
    const existing = optionByKey.get(key) ?? [];
    existing.push(option);
    optionByKey.set(key, existing);
  });

  const takeOptionByKey = (key: string): FilterOption | undefined => {
    const list = optionByKey.get(key);
    if (!list || list.length === 0) return undefined;
    const found = list.find((opt) => !matchedValues.has(opt.value));
    if (!found) return undefined;
    matchedValues.add(found.value);
    return found;
  };

  const groups: GroupedRegionOptionGroup[] = REGIONES_GROUPED.map((group) => {
    const ccaaAliasCandidates = [
      group.ccaa.label,
      ...(REGION_CCAA_ALIASES[group.ccaa.label] ?? []),
    ];
    let ccaaOption: FilterOption | undefined;
    for (const alias of ccaaAliasCandidates) {
      ccaaOption = takeOptionByKey(normalizeRegionGroupKey(alias));
      if (ccaaOption) break;
    }

    const provinces = group.items
      .map((province) => takeOptionByKey(normalizeRegionGroupKey(province.label)))
      .filter((opt): opt is FilterOption => Boolean(opt))
      .sort(byLabelEs);

    return {
      groupLabel: ccaaOption?.label || group.ccaa.label,
      ccaaOption,
      provinces,
    };
  }).filter((group) => group.ccaaOption || group.provinces.length > 0);

  const ungrouped = options
    .filter((option) => !matchedValues.has(option.value))
    .sort(byLabelEs);

  return { groups, ungrouped };
};

export const REGIONES_GROUPED: RegionGroup[] = [
  {
    ccaa: { value: 'ccaa:andalucia', label: 'Andalucía' },
    items: [
      { value: 'prov:almeria', label: 'Almería' },
      { value: 'prov:cadiz', label: 'Cádiz' },
      { value: 'prov:cordoba', label: 'Córdoba' },
      { value: 'prov:granada', label: 'Granada' },
      { value: 'prov:huelva', label: 'Huelva' },
      { value: 'prov:jaen', label: 'Jaén' },
      { value: 'prov:malaga', label: 'Málaga' },
      { value: 'prov:sevilla', label: 'Sevilla' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:aragon', label: 'Aragón' },
    items: [
      { value: 'prov:huesca', label: 'Huesca' },
      { value: 'prov:teruel', label: 'Teruel' },
      { value: 'prov:zaragoza', label: 'Zaragoza' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:asturias', label: 'Principado de Asturias' },
    items: [{ value: 'prov:asturias', label: 'Asturias' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:islas-baleares', label: 'Islas Baleares' },
    items: [{ value: 'prov:islas-baleares', label: 'Islas Baleares' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:canarias', label: 'Canarias' },
    items: [
      { value: 'prov:las-palmas', label: 'Las Palmas' },
      { value: 'prov:santa-cruz-de-tenerife', label: 'Santa Cruz de Tenerife' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:cantabria', label: 'Cantabria' },
    items: [{ value: 'prov:cantabria', label: 'Cantabria' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:castilla-la-mancha', label: 'Castilla-La Mancha' },
    items: [
      { value: 'prov:albacete', label: 'Albacete' },
      { value: 'prov:ciudad-real', label: 'Ciudad Real' },
      { value: 'prov:cuenca', label: 'Cuenca' },
      { value: 'prov:guadalajara', label: 'Guadalajara' },
      { value: 'prov:toledo', label: 'Toledo' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:castilla-y-leon', label: 'Castilla y León' },
    items: [
      { value: 'prov:avila', label: 'Ávila' },
      { value: 'prov:burgos', label: 'Burgos' },
      { value: 'prov:leon', label: 'León' },
      { value: 'prov:palencia', label: 'Palencia' },
      { value: 'prov:salamanca', label: 'Salamanca' },
      { value: 'prov:segovia', label: 'Segovia' },
      { value: 'prov:soria', label: 'Soria' },
      { value: 'prov:valladolid', label: 'Valladolid' },
      { value: 'prov:zamora', label: 'Zamora' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:cataluna', label: 'Cataluña' },
    items: [
      { value: 'prov:barcelona', label: 'Barcelona' },
      { value: 'prov:girona', label: 'Girona' },
      { value: 'prov:lleida', label: 'Lleida' },
      { value: 'prov:tarragona', label: 'Tarragona' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:comunitat-valenciana', label: 'Comunidad Valenciana' },
    items: [
      { value: 'prov:alicante', label: 'Alicante' },
      { value: 'prov:castellon', label: 'Castellón' },
      { value: 'prov:valencia', label: 'Valencia' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:extremadura', label: 'Extremadura' },
    items: [
      { value: 'prov:badajoz', label: 'Badajoz' },
      { value: 'prov:caceres', label: 'Cáceres' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:galicia', label: 'Galicia' },
    items: [
      { value: 'prov:a-coruna', label: 'A Coruña' },
      { value: 'prov:lugo', label: 'Lugo' },
      { value: 'prov:ourense', label: 'Ourense' },
      { value: 'prov:pontevedra', label: 'Pontevedra' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:comunidad-de-madrid', label: 'Comunidad de Madrid' },
    items: [{ value: 'prov:madrid', label: 'Madrid' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:region-de-murcia', label: 'Región de Murcia' },
    items: [{ value: 'prov:murcia', label: 'Murcia' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:navarra', label: 'Comunidad Foral de Navarra' },
    items: [{ value: 'prov:navarra', label: 'Navarra' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:pais-vasco', label: 'País Vasco' },
    items: [
      { value: 'prov:alava', label: 'Álava' },
      { value: 'prov:bizkaia', label: 'Bizkaia' },
      { value: 'prov:gipuzkoa', label: 'Gipuzkoa' },
    ].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:la-rioja', label: 'La Rioja' },
    items: [{ value: 'prov:la-rioja', label: 'La Rioja' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:ceuta', label: 'Ceuta' },
    items: [{ value: 'prov:ceuta', label: 'Ceuta' }].sort(byLabelEs),
  },
  {
    ccaa: { value: 'ccaa:melilla', label: 'Melilla' },
    items: [{ value: 'prov:melilla', label: 'Melilla' }].sort(byLabelEs),
  },
].sort((a, b) => a.ccaa.label.localeCompare(b.ccaa.label, 'es', { sensitivity: 'base' }));


export const FINALIDADES: FilterOption[] = [
  { value: 'acceso-vivienda', label: 'Acceso a la vivienda y fomento de la edificación' },
  { value: 'comercio-turismo-pymes', label: 'Comercio, Turismo y Pymes' },
  { value: 'desempleo', label: 'Desempleo' },
  { value: 'fomento-empleo', label: 'Fomento del Empleo' },
  { value: 'industria-energia', label: 'Industria y Energía' },
  { value: 'infraestructuras', label: 'Infraestructuras' },
  { value: 'investigacion-desarrollo-innovacion', label: 'Investigación, desarrollo e innovación' },
  { value: 'otras-actuaciones-economicas', label: 'Otras actuaciones de carácter económico' },
  { value: 'otras-prestaciones-economicas', label: 'Otras Prestaciones económicas' },
  { value: 'subvenciones-transporte', label: 'Subvenciones al transporte' },
];


export const BENEFICIARIOS: FilterOption[] = [
  { value: 'pyme', label: 'Pyme' },
  { value: 'autonomo', label: 'Autónomo' },
  { value: 'gran-empresa', label: 'Gran Empresa' },
  { value: 'entidad-sin-animo-de-lucro', label: 'Entidad (sin ánimo lucro)' },
  { value: 'asociacion', label: 'Asociación' },
];

export const MarketplaceSidebar: React.FC<MarketplaceSidebarProps> = ({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  filterOptions,
  amountFilter,
  dateFilter,
}) => {
  const beneficiarioOptions = filterOptions?.beneficiarios ?? [];
  const finalidadOptions = filterOptions?.finalidades ?? [];
  const regionOptions = filterOptions?.regiones ?? [];
  const groupedRegionOptions = groupRegionOptions(regionOptions);
  const administracionOptions = filterOptions?.administraciones_convocantes ?? [];
  const tipoAyudaOptions = filterOptions?.tipos_ayuda ?? [];
  const administracionesSelected = filters.administraciones_convocantes ?? [];
  const tiposAyudaSelected = filters.tipos_ayuda ?? [];
  const showExtendedSections = filterOptions !== undefined || administracionesSelected.length > 0 || tiposAyudaSelected.length > 0;

  const totalActiveFilters = 
    filters.beneficiarios.length + 
    filters.regiones.length + 
    filters.finalidades.length +
    administracionesSelected.length +
    tiposAyudaSelected.length +
    (amountFilter?.hasActive ? 1 : 0) +
    (dateFilter?.hasActive ? 1 : 0);
  const canClearFilters =
    hasActiveFilters || Boolean(amountFilter?.hasActive) || Boolean(dateFilter?.hasActive);
  const amountActiveCount = amountFilter?.hasActive ? 1 : 0;
  const dateActiveCount = (dateFilter?.startDate ? 1 : 0) + (dateFilter?.endDate ? 1 : 0);

  const SectionCountBadge = ({ count }: { count: number }) =>
    count > 0 ? (
      <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-violet-200 bg-violet-100 px-1 text-[10px] font-semibold leading-none text-violet-700 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
        {count}
      </span>
    ) : null;

  return (
    <div className="w-full h-full bg-background border-r border-border/50 overflow-y-auto">
      <div className="p-4 border-b border-border/50 sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-foreground">Filtros</h2>
          {totalActiveFilters > 0 && (
            <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-1 rounded-full">
              {totalActiveFilters} activos
            </span>
          )}
        </div>
        {canClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="p-4">
        <Accordion type="multiple" defaultValue={[]}>
          {amountFilter && (
            <AccordionItem value="importe">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span>Importe</span>
                  <SectionCountBadge count={amountActiveCount} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border border-border/60 p-3 space-y-3 mt-1">
                  <div>
                    <p className="text-sm font-medium">Importe total de la subvención</p>
                    <p className="text-xs text-muted-foreground">
                      Define una franja mínima y máxima de fondos totales moviendo ambos extremos.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={amountFilter.hasActive ? 'default' : 'secondary'} className="text-xs font-normal">
                      Desde {amountFilter.formatValue(amountFilter.value[0])}
                    </Badge>
                    <Badge variant={amountFilter.hasActive ? 'default' : 'secondary'} className="text-xs font-normal">
                      Hasta {amountFilter.formatValue(amountFilter.value[1])}
                    </Badge>
                    {amountFilter.hasActive && (
                      <Button variant="ghost" size="sm" onClick={amountFilter.onReset} className="ml-auto">
                        Reset
                      </Button>
                    )}
                  </div>

                  <Slider
                    min={amountFilter.min}
                    max={amountFilter.max}
                    step={amountFilter.step ?? 100_000}
                    value={amountFilter.value}
                    onValueChange={(value) => {
                      if (value.length !== 2) return;
                      amountFilter.onChange([
                        Math.min(value[0], value[1]),
                        Math.max(value[0], value[1]),
                      ]);
                    }}
                  />

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>0€</span>
                    <span>{amountFilter.formatValue(amountFilter.max)}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {dateFilter && (
            <AccordionItem value="fechas">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>Fecha de inicio / cierre</span>
                  <SectionCountBadge count={dateActiveCount} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="rounded-lg border border-border/60 p-3 space-y-3 mt-1">
                  <div>
                    <p className="text-sm font-medium">Ventana de fechas</p>
                    <p className="text-xs text-muted-foreground">
                      Filtra por fecha de inicio y fecha de cierre de la subvención.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sidebar-fecha-inicio" className="text-xs text-muted-foreground">
                        Fecha de inicio
                      </Label>
                      <Input
                        id="sidebar-fecha-inicio"
                        type="date"
                        value={dateFilter.startDate}
                        onChange={(event) => dateFilter.onStartDateChange(event.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sidebar-fecha-cierre" className="text-xs text-muted-foreground">
                        Fecha de cierre
                      </Label>
                      <Input
                        id="sidebar-fecha-cierre"
                        type="date"
                        value={dateFilter.endDate}
                        onChange={(event) => dateFilter.onEndDateChange(event.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={dateFilter.hasActive ? 'default' : 'secondary'} className="text-xs font-normal">
                      Inicio: {dateFilter.startDate || 'Sin filtro'}
                    </Badge>
                    <Badge variant={dateFilter.hasActive ? 'default' : 'secondary'} className="text-xs font-normal">
                      Cierre: {dateFilter.endDate || 'Sin filtro'}
                    </Badge>
                    {dateFilter.hasActive && (
                      <Button variant="ghost" size="sm" onClick={dateFilter.onReset} className="ml-auto">
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="beneficiarios">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>Beneficiarios</span>
                  <SectionCountBadge count={filters.beneficiarios.length} />
                </div>
              </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {beneficiarioOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay opciones disponibles por ahora.
                  </p>
                )}
                {beneficiarioOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    {(() => {
                      const checkboxId = optionCheckboxId('beneficiario', option.value);
                      return (
                        <>
                          <Checkbox
                            id={checkboxId}
                            checked={filters.beneficiarios.includes(option.value)}
                            onCheckedChange={() => onFilterChange('beneficiarios', option.value)}
                          />
                          <Label
                            htmlFor={checkboxId}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {option.label}
                          </Label>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="regiones">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>Región</span>
                  <SectionCountBadge count={filters.regiones.length} />
                </div>
              </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto pr-1">
                {regionOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay opciones disponibles por ahora.
                  </p>
                )}
                {groupedRegionOptions.groups.map((group) => {
                  const selectedInGroupCount =
                    (group.ccaaOption && filters.regiones.includes(group.ccaaOption.value) ? 1 : 0) +
                    group.provinces.filter((province) => filters.regiones.includes(province.value)).length;

                  return (
                    <details key={`region-group-${group.groupLabel}`} className="rounded-md border border-border/60 bg-background/60">
                      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none px-3 py-2 text-sm font-medium">
                        <span className="truncate">{group.groupLabel}</span>
                        {selectedInGroupCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {selectedInGroupCount}
                          </Badge>
                        )}
                      </summary>
                      <div className="px-3 pb-3 space-y-2">
                        {group.ccaaOption && (
                          <div className="flex items-center space-x-2">
                            {(() => {
                              const checkboxId = optionCheckboxId('region', group.ccaaOption.value);
                              return (
                                <>
                                  <Checkbox
                                    id={checkboxId}
                                    checked={filters.regiones.includes(group.ccaaOption.value)}
                                    onCheckedChange={() => onFilterChange('regiones', group.ccaaOption.value)}
                                  />
                                  <Label
                                    htmlFor={checkboxId}
                                    className="text-sm font-normal cursor-pointer flex-1"
                                  >
                                    {group.ccaaOption.label}
                                  </Label>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {group.provinces.length > 0 && (
                          <div className="ml-2 pl-3 border-l border-border/60 space-y-2">
                            {group.provinces.map((option) => (
                              <div key={option.value} className="flex items-center space-x-2">
                                {(() => {
                                  const checkboxId = optionCheckboxId('region', option.value);
                                  return (
                                    <>
                                      <Checkbox
                                        id={checkboxId}
                                        checked={filters.regiones.includes(option.value)}
                                        onCheckedChange={() => onFilterChange('regiones', option.value)}
                                      />
                                      <Label
                                        htmlFor={checkboxId}
                                        className="text-sm font-normal cursor-pointer flex-1"
                                      >
                                        {option.label}
                                      </Label>
                                    </>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}

                {groupedRegionOptions.ungrouped.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-1">
                      Otras regiones
                    </p>
                    {groupedRegionOptions.ungrouped.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        {(() => {
                          const checkboxId = optionCheckboxId('region', option.value);
                          return (
                            <>
                              <Checkbox
                                id={checkboxId}
                                checked={filters.regiones.includes(option.value)}
                                onCheckedChange={() => onFilterChange('regiones', option.value)}
                              />
                              <Label
                                htmlFor={checkboxId}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                {option.label}
                              </Label>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>


          <AccordionItem value="finalidades">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span>Finalidad</span>
                  <SectionCountBadge count={filters.finalidades.length} />
                </div>
              </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {finalidadOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay opciones disponibles por ahora.
                  </p>
                )}
                {finalidadOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    {(() => {
                      const checkboxId = optionCheckboxId('finalidad', option.value);
                      return (
                        <>
                          <Checkbox
                            id={checkboxId}
                            checked={filters.finalidades.includes(option.value)}
                            onCheckedChange={() => onFilterChange('finalidades', option.value)}
                          />
                          <Label
                            htmlFor={checkboxId}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {option.label}
                          </Label>
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {showExtendedSections && (
            <AccordionItem value="administraciones_convocantes">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <span>Administración convocante</span>
                  <SectionCountBadge count={administracionesSelected.length} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto pr-1">
                  {administracionOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No hay opciones disponibles por ahora.
                    </p>
                  )}
                  {administracionOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      {(() => {
                        const checkboxId = optionCheckboxId('administracion', option.value);
                        return (
                          <>
                            <Checkbox
                              id={checkboxId}
                              checked={administracionesSelected.includes(option.value)}
                              onCheckedChange={() => onFilterChange('administraciones_convocantes', option.value)}
                            />
                            <Label
                              htmlFor={checkboxId}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {option.label}
                            </Label>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {showExtendedSections && (
            <AccordionItem value="tipos_ayuda">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span>Tipo de Ayuda</span>
                  <SectionCountBadge count={tiposAyudaSelected.length} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2 max-h-[300px] overflow-y-auto pr-1">
                  {tipoAyudaOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No hay opciones disponibles por ahora.
                    </p>
                  )}
                  {tipoAyudaOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      {(() => {
                        const checkboxId = optionCheckboxId('tipo-ayuda', option.value);
                        return (
                          <>
                            <Checkbox
                              id={checkboxId}
                              checked={tiposAyudaSelected.includes(option.value)}
                              onCheckedChange={() => onFilterChange('tipos_ayuda', option.value)}
                            />
                            <Label
                              htmlFor={checkboxId}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {option.label}
                            </Label>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

      </div>
    </div>
  );
};
