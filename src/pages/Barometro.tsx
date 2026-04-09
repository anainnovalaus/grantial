import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Calendar, FileText, Radar, TrendingUp, TrainFront,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface BarometroData {
  kpis: {
    total_grants: number;
    grants_last_30_days: number;
    grants_last_7_days: number;
  };
  by_finalidad: { name: string; count: number }[];
  by_region: { name: string; count: number }[];
  by_beneficiario: { name: string; count: number }[];
  monthly_trend: { month: string; count: number }[];
  by_sector: { name: string; count: number }[];
  generated_at: string;
}

/* ─── Chart colors ───────────────────────────────────────────────────── */

const COLORS = [
  '#8b5cf6', '#a78bfa', '#c084fc', '#d946ef', '#e879f9',
  '#f0abfc', '#7c3aed', '#6d28d9', '#9333ea', '#a855f7',
];

/* ─── Helpers ────────────────────────────────────────────────────────── */

const formatMonth = (m: string) => {
  const [year, month] = m.split('-');
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${names[parseInt(month, 10) - 1]} ${year.slice(2)}`;
};

const formatNumber = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}K`
      : String(n);

/* ─── Custom tooltip ─────────────────────────────────────────────────── */

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-violet-600 font-semibold">{payload[0].value.toLocaleString('es-ES')}</p>
    </div>
  );
};

/* ─── Skeleton ───────────────────────────────────────────────────────── */

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-muted ${className}`} />
);

/* ─── KPI Card ───────────────────────────────────────────────────────── */

const KpiCard = ({ icon: Icon, value, label }: { icon: typeof Radar; value: string; label: string }) => (
  <Card className="border-border text-center">
    <CardContent className="p-6">
      <Icon className="h-7 w-7 text-violet-600 mx-auto mb-2" />
      <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </CardContent>
  </Card>
);

/* ─── Chart wrapper card ─────────────────────────────────────────────── */

const ChartCard = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <Card className={`border-border ${className}`}>
    <CardContent className="p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{title}</h3>
      {children}
    </CardContent>
  </Card>
);

/* ─── Page ───────────────────────────────────────────────────────────── */

const Barometro = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data, isLoading, isError } = useQuery<BarometroData>({
    queryKey: ['barometro'],
    queryFn: async () => {
      const res = await fetch('/api/barometro');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">

          {/* ── Hero ────────────────────────────────────────────── */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 shadow-sm mb-6">
              <Radar className="h-3.5 w-3.5" />
              Datos en tiempo real
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight">
              Barómetro de Subvenciones
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Nuestro radar tecnológico analiza miles de convocatorias públicas en España.
              Estos son los datos que genera: cuántos trenes pasan, por dónde y para quién.
            </p>
          </div>

          {/* ── KPIs ────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-14">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-muted-foreground">
              No se pudieron cargar los datos. Inténtalo de nuevo más tarde.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
                <KpiCard icon={FileText} value={formatNumber(data!.kpis.total_grants)} label="Subvenciones rastreadas" />
                <KpiCard icon={TrendingUp} value={String(data!.kpis.grants_last_30_days)} label="Publicadas (últimos 30 días)" />
                <KpiCard icon={Calendar} value={String(data!.kpis.grants_last_7_days)} label="Publicadas (últimos 7 días)" />
              </div>

              {/* ── Tendencia mensual ─────────────────────────────── */}
              <ChartCard title="Evolución mensual de convocatorias" className="mb-8">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data!.monthly_trend.map(d => ({ ...d, label: formatMonth(d.month) }))}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#areaGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* ── Finalidad + Beneficiarios ─────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <ChartCard title="Subvenciones por finalidad">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data!.by_finalidad} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + '...' : v}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {data!.by_finalidad.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard title="Tipo de beneficiario">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data!.by_beneficiario.slice(0, 8)}
                          cx="50%"
                          cy="50%"
                          innerRadius="45%"
                          outerRadius="75%"
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="name"
                        >
                          {data!.by_beneficiario.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [value.toLocaleString('es-ES'), name]}
                        />
                        <Legend
                          formatter={(value: string) => (
                            <span className="text-[11px] text-muted-foreground">
                              {value.length > 25 ? value.slice(0, 23) + '...' : value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              {/* ── Región + Sector ───────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-14">
                <ChartCard title="Subvenciones por región">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data!.by_region.slice(0, 12)} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={160}
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v: string) => v.length > 25 ? v.slice(0, 23) + '...' : v}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                          {data!.by_region.slice(0, 12).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>

                <ChartCard title="Subvenciones por sector">
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data!.by_sector} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={160}
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v: string) => v.length > 25 ? v.slice(0, 23) + '...' : v}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" fill="#d946ef" radius={[0, 4, 4, 0]}>
                          {data!.by_sector.map((_, i) => (
                            <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              {/* ── Timestamp ────────────────────────────────────── */}
              <p className="text-center text-xs text-muted-foreground/60 mb-10">
                Datos actualizados: {new Date(data!.generated_at).toLocaleString('es-ES')}
              </p>
            </>
          )}

          {/* ── CTA ─────────────────────────────────────────────── */}
          <Card className="overflow-hidden border-0 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
            <CardContent className="p-10 text-center">
              <TrainFront className="h-8 w-8 mx-auto mb-4 text-white/80" />
              <h3 className="text-2xl font-bold mb-3">Tu tren puede estar saliendo ahora mismo</h3>
              <p className="text-white/80 mb-8 max-w-xl mx-auto leading-relaxed">
                Cada mes se publican cientos de nuevas convocatorias. Solo necesitas tu
                nombre y CIF para que nuestro radar empiece a buscar las que encajan contigo.
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
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
};

export default Barometro;
