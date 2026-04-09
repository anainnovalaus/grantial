import React, { useState } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Calculator,
  ChevronRight,
  Euro,
  MapPin,
  Radar,
  TrainFront,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ─── Data ─────────────────────────────────────────────────────────────── */

export const SECTORS = [
  'Tecnología / Software',
  'Industria / Manufactura',
  'Salud / Biotech',
  'Energía / Medioambiente',
  'Agroalimentario',
  'Construcción / Inmobiliario',
  'Comercio / Retail',
  'Turismo / Hostelería',
  'Educación / Formación',
  'Transporte / Logística',
  'Servicios profesionales',
  'Cultura / Deporte',
] as const;

export const REGIONS = [
  'Andalucía',
  'Aragón',
  'Asturias',
  'Canarias',
  'Cantabria',
  'Castilla y León',
  'Castilla-La Mancha',
  'Cataluña',
  'Comunidad Valenciana',
  'Extremadura',
  'Galicia',
  'Islas Baleares',
  'La Rioja',
  'Madrid',
  'Murcia',
  'Navarra',
  'País Vasco',
  'Nacional / Todas',
] as const;

export const EMPLOYEES = [
  { label: '1-10', multiplier: 0.8 },
  { label: '11-50', multiplier: 1.0 },
  { label: '51-250', multiplier: 1.12 },
  { label: '250+', multiplier: 1.05 },
] as const;

export const REVENUE = [
  { label: '< 500K€', multiplier: 0.85 },
  { label: '500K - 2M€', multiplier: 1.0 },
  { label: '2M - 10M€', multiplier: 1.12 },
  { label: '> 10M€', multiplier: 1.05 },
] as const;

/* ─── Estimation logic ─────────────────────────────────────────────────── */

interface SectorEstimateProfile {
  grants: number;
  realisticAwardsPerYear: number;
  avgAwardPerGrant: number;
  annualFundingCap: number;
  missedRate: number;
}

// Conservative estimates: amount usually reachable by a beneficiary,
// not the total budget announced for the call.
const SECTOR_BASE: Record<string, SectorEstimateProfile> = {
  'Tecnología / Software': {
    grants: 70,
    realisticAwardsPerYear: 2.0,
    avgAwardPerGrant: 70000,
    annualFundingCap: 280000,
    missedRate: 0.32,
  },
  'Industria / Manufactura': {
    grants: 85,
    realisticAwardsPerYear: 2.1,
    avgAwardPerGrant: 85000,
    annualFundingCap: 300000,
    missedRate: 0.34,
  },
  'Salud / Biotech': {
    grants: 55,
    realisticAwardsPerYear: 1.8,
    avgAwardPerGrant: 100000,
    annualFundingCap: 300000,
    missedRate: 0.35,
  },
  'Energía / Medioambiente': {
    grants: 72,
    realisticAwardsPerYear: 1.8,
    avgAwardPerGrant: 90000,
    annualFundingCap: 260000,
    missedRate: 0.33,
  },
  'Agroalimentario': {
    grants: 82,
    realisticAwardsPerYear: 2.0,
    avgAwardPerGrant: 55000,
    annualFundingCap: 180000,
    missedRate: 0.3,
  },
  'Construcción / Inmobiliario': {
    grants: 45,
    realisticAwardsPerYear: 1.4,
    avgAwardPerGrant: 50000,
    annualFundingCap: 140000,
    missedRate: 0.28,
  },
  'Comercio / Retail': {
    grants: 38,
    realisticAwardsPerYear: 1.6,
    avgAwardPerGrant: 25000,
    annualFundingCap: 75000,
    missedRate: 0.24,
  },
  'Turismo / Hostelería': {
    grants: 42,
    realisticAwardsPerYear: 1.6,
    avgAwardPerGrant: 30000,
    annualFundingCap: 90000,
    missedRate: 0.25,
  },
  'Educación / Formación': {
    grants: 36,
    realisticAwardsPerYear: 1.4,
    avgAwardPerGrant: 35000,
    annualFundingCap: 90000,
    missedRate: 0.25,
  },
  'Transporte / Logística': {
    grants: 35,
    realisticAwardsPerYear: 1.4,
    avgAwardPerGrant: 60000,
    annualFundingCap: 160000,
    missedRate: 0.28,
  },
  'Servicios profesionales': {
    grants: 30,
    realisticAwardsPerYear: 1.3,
    avgAwardPerGrant: 28000,
    annualFundingCap: 70000,
    missedRate: 0.22,
  },
  'Cultura / Deporte': {
    grants: 34,
    realisticAwardsPerYear: 1.5,
    avgAwardPerGrant: 18000,
    annualFundingCap: 60000,
    missedRate: 0.2,
  },
};

// Softer multipliers so the result stays grounded in realistic award sizes.
const REGION_MULTI: Record<string, number> = {
  'Andalucía': 1.08,
  'Aragón': 0.98,
  'Asturias': 0.96,
  'Canarias': 1.0,
  'Cantabria': 0.95,
  'Castilla y León': 0.98,
  'Castilla-La Mancha': 0.98,
  'Cataluña': 1.06,
  'Comunidad Valenciana': 1.05,
  'Extremadura': 0.98,
  'Galicia': 1.0,
  'Islas Baleares': 0.96,
  'La Rioja': 0.95,
  'Madrid': 1.05,
  'Murcia': 0.98,
  'Navarra': 1.02,
  'País Vasco': 1.07,
  'Nacional / Todas': 1.12,
};

export interface CalculatorResult {
  grants: number;
  totalFunding: number;
  missedPerYear: number;
}

const roundToNearest = (value: number, step: number) => {
  if (step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
};

export function estimateOpportunities(
  sector: string,
  region: string,
  employeeIdx: number,
  revenueIdx: number,
): CalculatorResult {
  const base = SECTOR_BASE[sector] || {
    grants: 50,
    realisticAwardsPerYear: 1.6,
    avgAwardPerGrant: 50000,
    annualFundingCap: 150000,
    missedRate: 0.28,
  };
  const regionMul = REGION_MULTI[region] || 1.0;
  const empMul = EMPLOYEES[employeeIdx]?.multiplier ?? 1.0;
  const revMul = REVENUE[revenueIdx]?.multiplier ?? 1.0;

  const grants = Math.round(base.grants * regionMul * empMul * revMul);
  const realisticAwards = Math.max(
    1,
    Math.min(3.2, base.realisticAwardsPerYear * empMul * revMul),
  );
  const rawFunding = base.avgAwardPerGrant * realisticAwards * regionMul;
  const totalFunding = Math.min(
    base.annualFundingCap,
    Math.max(15000, roundToNearest(rawFunding, 5000)),
  );
  const missedPerYear = Math.min(
    totalFunding - 5000,
    Math.max(5000, roundToNearest(totalFunding * base.missedRate, 1000)),
  );

  return { grants, totalFunding, missedPerYear };
}

/* ─── Calculator Widget ────────────────────────────────────────────────── */

export const CalculatorWidget = ({ embedded = false }: { embedded?: boolean }) => {
  const [step, setStep] = useState(0);
  const [sector, setSector] = useState('');
  const [region, setRegion] = useState('');
  const [employees, setEmployees] = useState(-1);
  const [revenue, setRevenue] = useState(-1);
  const [result, setResult] = useState<CalculatorResult | null>(null);

  const handleCalculate = () => {
    setResult(estimateOpportunities(sector, region, employees, revenue));
    setStep(4);
  };

  const canProceed = () => {
    if (step === 0) return sector !== '';
    if (step === 1) return region !== '';
    if (step === 2) return employees >= 0;
    if (step === 3) return revenue >= 0;
    return false;
  };

  const nextStep = () => {
    if (step === 3) {
      handleCalculate();
    } else {
      setStep(step + 1);
    }
  };

  const reset = () => {
    setStep(0);
    setSector('');
    setRegion('');
    setEmployees(-1);
    setRevenue(-1);
    setResult(null);
  };

  const formatCurrency = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K€`;
    return `${n}€`;
  };

  const stepLabels = ['Sector', 'Región', 'Tamaño', 'Facturación'];

  return (
    <div className={`mx-auto w-full ${embedded ? 'max-w-2xl' : 'max-w-3xl'}`}>
      {/* Progress bar */}
      {step < 4 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i <= step
                      ? 'bg-violet-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </div>
                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                  {label}
                </span>
                {i < 3 && (
                  <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground/40 hidden sm:inline" />
                )}
              </div>
            ))}
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
              style={{ width: `${((step + 1) / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step-0"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-foreground mb-1">
              ¿En qué sector opera tu empresa?
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Selecciona el que más se aproxime a tu actividad principal.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SECTORS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSector(s)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    sector === s
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 font-medium shadow-sm'
                      : 'border-border bg-card text-foreground hover:border-violet-300 hover:bg-muted/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-foreground mb-1">
              ¿En qué comunidad autónoma estás?
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Las subvenciones varían mucho según la región.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    region === r
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 font-medium shadow-sm'
                      : 'border-border bg-card text-foreground hover:border-violet-300 hover:bg-muted/50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-foreground mb-1">
              ¿Cuántos empleados tenéis?
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              El tamaño de la empresa determina a qué convocatorias puedes optar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {EMPLOYEES.map((e, i) => (
                <button
                  key={e.label}
                  onClick={() => setEmployees(i)}
                  className={`rounded-xl border px-4 py-4 text-center transition-all ${
                    employees === i
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 font-medium shadow-sm'
                      : 'border-border bg-card text-foreground hover:border-violet-300 hover:bg-muted/50'
                  }`}
                >
                  <Users className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                  <span className="text-lg font-semibold">{e.label}</span>
                  <span className="block text-xs text-muted-foreground">empleados</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-foreground mb-1">
              ¿Cuál es vuestra facturación anual?
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Nos ayuda a estimar el rango de ayudas al que podrías acceder.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {REVENUE.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => setRevenue(i)}
                  className={`rounded-xl border px-4 py-4 text-center transition-all ${
                    revenue === i
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 font-medium shadow-sm'
                      : 'border-border bg-card text-foreground hover:border-violet-300 hover:bg-muted/50'
                  }`}
                >
                  <Euro className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
                  <span className="text-lg font-semibold">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">al año</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 4 && result && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
              <Radar className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold text-foreground sm:text-3xl">
              Según nuestros datos...
            </h3>
            <p className="mt-2 text-muted-foreground">
              {sector} · {region} · {EMPLOYEES[employees]?.label} empleados
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <TrainFront className="h-6 w-6 text-violet-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-foreground">{result.grants}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  subvenciones compatibles<br />
                  <span className="text-xs">(últimos 12 meses)</span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <TrendingUp className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-emerald-600">{formatCurrency(result.totalFunding)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  en financiación<br />
                  <span className="text-xs">potencialmente accesible</span>
                </div>
              </div>
              <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                <Euro className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-amber-600">{formatCurrency(result.missedPerYear)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  podrías estar dejando<br />
                  <span className="text-xs font-medium text-amber-600">escapar cada año</span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="group rounded-full bg-violet-600 px-7 text-white hover:bg-violet-700"
                >
                  Descubrir mis subvenciones
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-border px-7 text-foreground hover:bg-muted"
                onClick={reset}
              >
                Volver a calcular
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground/60">
              * Estimación conservadora basada en importes habituales para el beneficiario,
              no en el presupuesto total de cada convocatoria. El resultado real depende del
              perfil completo de tu entidad.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            className={`text-sm font-medium transition-colors ${
              step > 0
                ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                : 'text-transparent pointer-events-none'
            }`}
          >
            ← Atrás
          </button>
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
            className="rounded-full bg-violet-600 px-6 text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {step === 3 ? 'Calcular' : 'Siguiente'}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

/* ─── Standalone Page ──────────────────────────────────────────────────── */

const Calculadora = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 shadow-sm mb-6">
              <Calculator className="h-3.5 w-3.5" />
              Herramienta gratuita
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight">
              Calculadora de Oportunidades
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Descubre en 30 segundos cuántas subvenciones podrías estar perdiendo.
              Solo necesitas responder 4 preguntas.
            </p>
          </div>

          {/* Calculator */}
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm">
            <CalculatorWidget />
          </div>

          {/* CTA bottom */}
          <div className="mt-14 rounded-3xl overflow-hidden border-0 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white p-10 text-center">
            <Building2 className="h-8 w-8 mx-auto mb-4 text-white/80" />
            <h3 className="text-2xl font-bold mb-3">
              El radar que necesitas para no perder más trenes
            </h3>
            <p className="text-white/80 mb-8 max-w-xl mx-auto leading-relaxed">
              Con solo tu nombre y CIF, Grantial cruza tu perfil con miles de
              subvenciones y te avisa antes de que pase el tren.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="rounded-full bg-white text-violet-700 hover:bg-white/90 px-8 font-semibold">
                  Empezar gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/">
                <Button size="lg" className="rounded-full border border-white/30 bg-transparent text-white hover:bg-white/10 px-8">
                  Cómo funciona
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Calculadora;
