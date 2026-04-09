import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BellRing,
  Building2,
  Check,
  ChevronDown,
  FileText,
  MessageSquare,
  Radar,
  Search,
  Shuffle,
  Sparkles,
  Star,
  TrainFront,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';
import CookieConsent from '@/components/CookieConsent';
import { CalculatorWidget } from '@/pages/Calculadora';

/* ─── Data ────────────────────────────────────────────────────────────── */

interface JourneyStep {
  number: string;
  title: string;
  description: string;
  supportText: string;
  highlight: string;
  icon: LucideIcon;
}

const journeySteps: JourneyStep[] = [
  {
    number: '01',
    title: 'Tu identificación es tu billete de entrada',
    description:
      'Como pasajero, solo necesitas enseñar tu identificación: nombre y CIF. Con eso abrimos las puertas de la estación y nuestro radar empieza a buscar trenes para ti.',
    supportText:
      'Cuanto más nos cuentes sobre tu empresa, más fácil será decirte qué tren es mejor para ti y cómo llegar antes a tu destino.',
    highlight: 'Nombre + CIF',
    icon: Building2,
  },
  {
    number: '02',
    title: 'Nuestro radar cruza +5.000 subvenciones con tu perfil',
    description:
      'En lugar de revisar convocatorias una por una, Grantial cruza tu perfil con miles de subvenciones y te muestra las que realmente podrías pedir.',
    supportText:
      'Menos ruido, menos lectura inútil y más foco en oportunidades con sentido para tu entidad.',
    highlight: '+5.000 subvenciones',
    icon: Search,
  },
  {
    number: '03',
    title: 'Llega antes con alertas, resúmenes y filtros',
    description:
      'Las subvenciones no están para cuando tú las necesitas: salen cuando salen. Por eso te ayudamos a enterarte antes, entender rápido la convocatoria y priorizar.',
    supportText:
      'El tren no te espera. La ventaja está en verlo a tiempo y decidir si te subes.',
    highlight: 'Antes que nadie',
    icon: BellRing,
  },
];

/* ─── Animation helpers ───────────────────────────────────────────────── */

const appleEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, amount: 0.3 } as const,
  transition: { duration: 0.7, ease: appleEase, delay },
});

/* ─── Fixed Train Track (desktop only) ────────────────────────────────── */

const TrainTrack = () => {
  const { scrollYProgress } = useScroll();

  // Measure real DOM positions of the journey step cards
  const [stationScrollValues, setStationScrollValues] = useState<number[]>([0.3, 0.45, 0.6]);

  useEffect(() => {
    const measure = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll <= 0) return;

      const values: number[] = [];
      for (let i = 0; i < 3; i++) {
        const el = document.getElementById(`journey-step-${i}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const elCenterAbsolute = window.scrollY + rect.top + rect.height / 2;
          // scroll progress when the element center reaches viewport center
          const progress = (elCenterAbsolute - window.innerHeight / 2) / totalScroll;
          values.push(Math.max(0.05, Math.min(0.95, progress)));
        }
      }
      if (values.length === 3) setStationScrollValues(values);
    };

    // Measure after layout settles
    measure();
    const timer = setTimeout(measure, 500);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const [s1, s2, s3] = stationScrollValues;

  // Train travels from 4vh to 86vh. Map so it reaches each station vh when scroll hits that step.
  // trainVh at scroll s = 4 + (s / endScroll) * 82
  const endScroll = Math.min(s3 + 0.12, 0.92);
  const trainVhAt = (s: number) => 4 + (s / endScroll) * 82;
  const station1Vh = trainVhAt(s1);
  const station2Vh = trainVhAt(s2);
  const station3Vh = trainVhAt(s3);

  const rawTrainY = useTransform(scrollYProgress, [0, endScroll], [4, 86]);
  const smoothTrainY = useSpring(rawTrainY, { stiffness: 80, damping: 28 });
  const trainY = useTransform(smoothTrainY, (v) => `${v}vh`);

  const trackOpacity = useTransform(
    scrollYProgress,
    [0, 0, endScroll, endScroll + 0.1],
    [1, 1, 1, 0],
  );

  const fillHeight = useTransform(
    scrollYProgress,
    [0, endScroll],
    ['0%', '100%'],
  );

  // Dot activations: light up slightly before the train arrives
  const delta = 0.04;
  const dot1Opacity = useTransform(scrollYProgress, [s1 - delta, s1], [0.2, 1]);
  const dot2Opacity = useTransform(scrollYProgress, [s2 - delta, s2], [0.2, 1]);
  const dot3Opacity = useTransform(scrollYProgress, [s3 - delta, s3], [0.2, 1]);

  const dot1Scale = useTransform(scrollYProgress, [s1 - delta, s1], [0.7, 1]);
  const dot2Scale = useTransform(scrollYProgress, [s2 - delta, s2], [0.7, 1]);
  const dot3Scale = useTransform(scrollYProgress, [s3 - delta, s3], [0.7, 1]);

  const stationLabels = ['Estación 1', 'Estación 2', 'Estación 3'];
  const stations = [
    { top: `${station1Vh}vh`, opacity: dot1Opacity, scale: dot1Scale, label: stationLabels[0] },
    { top: `${station2Vh}vh`, opacity: dot2Opacity, scale: dot2Scale, label: stationLabels[1] },
    { top: `${station3Vh}vh`, opacity: dot3Opacity, scale: dot3Scale, label: stationLabels[2] },
  ];

  return (
    <motion.div
      className="pointer-events-none fixed inset-y-0 left-[5%] z-[1] hidden w-40 md:block lg:left-[7%]"
      style={{ opacity: trackOpacity }}
      aria-hidden="true"
    >
      {/* Rails */}
      <div className="absolute inset-y-[2%] left-[18px] w-[2px] rounded-full bg-border" />
      <div className="absolute inset-y-[2%] left-[28px] w-[2px] rounded-full bg-border" />

      {/* Ties */}
      <div
        className="absolute inset-y-[2%] left-[14px] w-[20px] opacity-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0px, transparent 18px, currentColor 18px, currentColor 21px, transparent 21px, transparent 40px)',
          color: 'hsl(var(--border))',
        }}
      />

      {/* Progress fill */}
      <motion.div
        className="absolute left-[22px] top-[2%] w-[2px] origin-top rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500"
        style={{ height: fillHeight }}
      />

      {/* Station dots with labels */}
      {stations.map((station, i) => (
        <motion.div
          key={i}
          className="absolute left-[10px] flex items-center gap-3"
          style={{
            top: station.top,
            opacity: station.opacity,
            scale: station.scale,
          }}
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-violet-400 bg-background shadow-sm">
            <div className="h-[8px] w-[8px] rounded-full bg-violet-500" />
          </div>
          <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-violet-600">
            {station.label}
          </span>
        </motion.div>
      ))}

      {/* Train icon */}
      <motion.div
        className="absolute left-[12px] flex h-[24px] w-[24px] items-center justify-center rounded-lg bg-violet-600 text-white shadow-lg shadow-violet-500/30"
        style={{ top: trainY }}
      >
        <TrainFront className="h-3 w-3" />
      </motion.div>
    </motion.div>
  );
};

/* ─── Hero Section ────────────────────────────────────────────────────── */

const HeroSection = () => {
  const { scrollYProgress } = useScroll();
  const scrollIndicatorOpacity = useTransform(
    scrollYProgress,
    [0, 0.04],
    [1, 0],
  );

  return (
    <section className="relative flex min-h-[85vh] flex-col items-center px-4 pt-28 sm:pt-32 md:pt-36">
      <div className="mx-auto max-w-4xl text-center">
        <motion.p
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: appleEase }}
        >
          <TrainFront className="h-3.5 w-3.5" />
          Subvenciones como trenes
        </motion.p>

        <motion.h1
          className="mt-8 text-[2.5rem] font-semibold leading-[1.2] tracking-tight text-foreground sm:text-5xl md:text-7xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: appleEase }}
        >
          No persigas subvenciones.
          <span className="mt-2 block bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
            Súbete a las que te encajan.
          </span>
        </motion.h1>

        {/* App preview */}
        <motion.div
          className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-xl border border-border/50 shadow-2xl shadow-violet-500/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: appleEase }}
        >
          <img
            src="/app-preview.png"
            alt="Vista del marketplace de subvenciones de Grantial"
            className="w-full h-auto"
          />
        </motion.div>

        <motion.div
          className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: appleEase }}
        >
          <Link to="/entities">
            <Button
              size="lg"
              className="group h-12 rounded-full bg-violet-600 px-7 text-white hover:bg-violet-700"
            >
              Crear perfil de entidad
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link to="/barometro">
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-border px-7 text-foreground hover:bg-muted"
            >
              Ver barómetro de subvenciones
            </Button>
          </Link>
        </motion.div>

      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        style={{ opacity: scrollIndicatorOpacity }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ─── Metaphor Bridge Section ─────────────────────────────────────────── */

const MetaphorSection = () => (
  <section id="section-metafora" className="scroll-mt-20 px-4 py-28 md:py-40">
    <div className="mx-auto max-w-4xl text-center">
      <motion.p
        className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600"
        {...fadeUp()}
      >
        La metáfora
      </motion.p>
      <motion.h2
        className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl"
        {...fadeUp(0.1)}
      >
        Las subvenciones pasan.
        <span className="block text-muted-foreground">
          Tu empresa decide si se sube.
        </span>
      </motion.h2>
      <motion.p
        className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
        {...fadeUp(0.2)}
      >
        No aparecen justo cuando las necesitas. Aparecen cuando salen. Si no ves
        ese tren, lo pierdes y no sabes cuándo volverá a pasar. Grantial es el
        radar tecnológico que te acompaña en el andén para que no pierdas
        ninguno.
      </motion.p>

      <motion.div
        className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
        {...fadeUp(0.3)}
      >
        <div className="rounded-2xl bg-muted/40 p-6 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
            <TrainFront className="h-5 w-5 text-violet-600" />
          </div>
          <p className="mt-3 text-lg font-semibold text-foreground">
            El Tren
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            La subvención estacionada. Sale cuando sale, no cuando tú la
            necesitas.
          </p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-6 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-100 dark:bg-fuchsia-900/40">
            <FileText className="h-5 w-5 text-fuchsia-600" />
          </div>
          <p className="mt-3 text-lg font-semibold text-foreground">
            El Billete
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Los requisitos y la documentación técnica que necesitas para subir a
            bordo.
          </p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-6 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <User className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-3 text-lg font-semibold text-foreground">
            El Pasajero
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Tú. A menudo no sabes cuándo pasa el tren ni dónde está la
            taquilla. Solo necesitas tu identificación para entrar.
          </p>
        </div>
        <div className="rounded-2xl border-2 border-violet-500/20 bg-gradient-to-br from-violet-50/60 to-fuchsia-50/40 dark:from-violet-950/30 dark:to-fuchsia-950/20 p-6 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Radar className="h-5 w-5 text-white" />
          </div>
          <p className="mt-3 text-lg font-semibold text-foreground">
            Grantial
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            El radar tecnológico del andén. Identifica a qué tren debes subirte
            para llegar a tu destino.
          </p>
        </div>
      </motion.div>

    </div>
  </section>
);

/* ─── Step visual illustrations (CSS-only) ────────────────────────────── */

const StepIllustration = ({ stepNumber }: { stepNumber: string }) => {
  if (stepNumber === '01') {
    // Train ticket illustration
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="relative w-full max-w-[230px]">
          {/* Ticket shape with notch edges */}
          <div className="relative overflow-hidden rounded-2xl border border-violet-200 dark:border-violet-800/60 bg-card shadow-sm">
            {/* Ticket header band */}
            <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <TrainFront className="h-3.5 w-3.5 text-white/90" />
                <span className="text-[11px] font-bold tracking-wide text-white">
                  GRANTIAL PASS
                </span>
              </div>
              <span className="text-[9px] font-medium text-white/70">N.º 0001</span>
            </div>

            {/* Dashed separator with circle cutouts */}
            <div className="relative flex items-center">
              <div className="absolute -left-[7px] h-[14px] w-[14px] rounded-full bg-gradient-to-br from-violet-50/50 to-fuchsia-50/30 dark:from-violet-950/20 dark:to-fuchsia-950/10" />
              <div className="w-full border-t-2 border-dashed border-violet-200 dark:border-violet-800/40" />
              <div className="absolute -right-[7px] h-[14px] w-[14px] rounded-full bg-gradient-to-br from-violet-50/50 to-fuchsia-50/30 dark:from-violet-950/20 dark:to-fuchsia-950/10" />
            </div>

            {/* Ticket body */}
            <div className="space-y-2 px-4 py-3">
              {/* Required fields - filled in */}
              <div className="flex items-center gap-2.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span className="text-[11px] font-semibold text-foreground">Nombre</span>
                <div className="ml-auto h-[6px] w-16 rounded-full bg-violet-400/60" />
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span className="text-[11px] font-semibold text-foreground">CIF</span>
                <div className="ml-auto h-[6px] w-12 rounded-full bg-violet-400/60" />
              </div>

              {/* Thin divider */}
              <div className="border-t border-dashed border-muted-foreground/15" />

              {/* Optional fields - empty / placeholder */}
              <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Cuanto más, mejor
              </p>
              <div className="flex items-center gap-2.5">
                <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/25" />
                <span className="text-[11px] text-muted-foreground">Página web</span>
                <div className="ml-auto h-[6px] w-14 rounded-full bg-muted/60" />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/25" />
                <span className="text-[11px] text-muted-foreground">Descripción</span>
                <div className="ml-auto h-[6px] w-10 rounded-full bg-muted/60" />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/25" />
                <span className="text-[11px] text-muted-foreground">Documentos</span>
                <div className="ml-auto h-[6px] w-8 rounded-full bg-muted/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (stepNumber === '02') {
    // Radar illustration
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="relative flex h-[200px] w-[200px] items-center justify-center">
          {/* Radar background */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-violet-950 to-gray-950 shadow-inner" />

          {/* Grid lines - circles */}
          {[80, 60, 40, 20].map((size) => (
            <div
              key={size}
              className="absolute rounded-full border border-violet-500/20"
              style={{ width: `${size}%`, height: `${size}%` }}
            />
          ))}

          {/* Cross lines */}
          <div className="absolute left-1/2 top-[10%] h-[80%] w-px -translate-x-1/2 bg-violet-500/20" />
          <div className="absolute left-[10%] top-1/2 h-px w-[80%] -translate-y-1/2 bg-violet-500/20" />

          {/* Rotating sweep */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-bottom-left"
            style={{ transformOrigin: '0% 0%' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="h-full w-full rounded-tr-full"
              style={{
                background:
                  'conic-gradient(from 0deg at 0% 100%, transparent 0deg, rgba(139,92,246,0.35) 30deg, transparent 60deg)',
              }}
            />
          </motion.div>

          {/* Blips - detected grants */}
          {[
            { top: '22%', left: '58%', delay: 0, size: 8, opacity: 1 },
            { top: '38%', left: '30%', delay: 0.8, size: 6, opacity: 0.8 },
            { top: '60%', left: '65%', delay: 1.6, size: 7, opacity: 0.9 },
          ].map((blip, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-fuchsia-400"
              style={{
                top: blip.top,
                left: blip.left,
                width: blip.size,
                height: blip.size,
              }}
              animate={{
                opacity: [0, blip.opacity, blip.opacity, 0],
                scale: [0.5, 1.2, 1, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: blip.delay,
                ease: 'easeInOut',
              }}
            >
              {/* Glow ring */}
              <div className="absolute -inset-1 animate-ping rounded-full bg-fuchsia-400/30" style={{ animationDuration: '2s', animationDelay: `${blip.delay}s` }} />
            </motion.div>
          ))}

          {/* Center dot */}
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_6px_2px_rgba(139,92,246,0.5)]" />

          {/* Subtle outer glow */}
          <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(139,92,246,0.15)]" />
        </div>
      </div>
    );
  }
  // Step 03 — alerts illustration
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full max-w-[200px] space-y-2">
        {['Nueva subvención disponible', 'Plazo cierra en 5 días', 'Nuevo match: 91%'].map(
          (text, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  i === 0
                    ? 'bg-violet-100 text-violet-600'
                    : i === 1
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <BellRing className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-medium text-foreground">
                {text}
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
};

/* ─── Single Journey Step ─────────────────────────────────────────────── */

const JourneyStepCard = ({
  step,
  index,
}: {
  step: JourneyStep;
  index: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.25 });
  const Icon = step.icon;
  const isEven = index % 2 === 0;

  return (
    <div
      id={`journey-step-${index}`}
      ref={ref}
      className="px-4 py-10 md:py-16 md:pl-[18%] lg:pl-[20%]"
    >
      <motion.div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-muted/30 shadow-sm"
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: appleEase }}
      >
        {/* Top gradient accent */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-400" />

        <div
          className={`grid grid-cols-1 gap-0 md:grid-cols-2 ${
            !isEven ? 'md:[direction:rtl]' : ''
          }`}
        >
          {/* Text content */}
          <div className="p-7 sm:p-10 md:[direction:ltr]">
            {/* Watermark number */}
            <span
              className="pointer-events-none absolute select-none font-bold text-foreground/[0.03]"
              style={{ fontSize: 'clamp(80px, 8vw, 120px)', lineHeight: 1, top: '10px', right: '20px' }}
            >
              {step.number}
            </span>

            <div className="relative flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600">
                  Estación {step.number}
                </span>
                <span className="ml-2 inline-flex items-center rounded-full bg-fuchsia-50 dark:bg-fuchsia-950/40 px-2.5 py-0.5 text-[10px] font-medium text-fuchsia-700 dark:text-fuchsia-400">
                  {step.highlight}
                </span>
              </div>
            </div>

            <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {step.title}
            </h3>

            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {step.description}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground/70">
              {step.supportText}
            </p>
          </div>

          {/* Visual illustration */}
          <div className="flex items-center justify-center bg-gradient-to-br from-violet-50/50 to-fuchsia-50/30 dark:from-violet-950/20 dark:to-fuchsia-950/10 p-6 sm:p-8 md:[direction:ltr]">
            <motion.div
              className="w-full"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.7, ease: appleEase, delay: 0.2 }}
            >
              <StepIllustration stepNumber={step.number} />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Mobile connector line */}
      {index < journeySteps.length - 1 && (
        <div className="mx-auto mt-6 flex flex-col items-center md:hidden">
          <div className="h-8 w-[2px] bg-gradient-to-b from-violet-300 to-violet-100" />
          <div className="h-2 w-2 rounded-full bg-violet-300" />
        </div>
      )}
    </div>
  );
};

/* ─── Journey Steps Section ───────────────────────────────────────────── */

const JourneySection = () => (
  <section id="section-como-funciona" className="scroll-mt-20 py-10 md:py-16">
    <div className="mx-auto max-w-5xl px-4 pb-4 text-center md:pl-[18%] md:text-left lg:pl-[20%]">
      <motion.p
        className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600"
        {...fadeUp()}
      >
        Cómo funciona
      </motion.p>
      <motion.h2
        className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        {...fadeUp(0.1)}
      >
        Tu ruta de tres estaciones
      </motion.h2>
      <motion.p
        className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground"
        {...fadeUp(0.15)}
      >
        Piensa en cada convocatoria como un tren que sale a una hora concreta.
        Esta es la ruta para que no lo pierdas.
      </motion.p>
    </div>

    {journeySteps.map((step, i) => (
      <JourneyStepCard key={step.number} step={step} index={i} />
    ))}
  </section>
);

/* ─── Extra Features Section ──────────────────────────────────────────── */

const ExtraFeaturesSection = () => (
  <section id="section-funcionalidades" className="scroll-mt-20 px-4 py-24 md:py-32">
    <div className="mx-auto max-w-6xl">
      <div className="mb-14 text-center">
        <motion.p
          className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600"
          {...fadeUp()}
        >
          Funcionalidades extra
        </motion.p>
        <motion.h2
          className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          {...fadeUp(0.1)}
        >
          Dos herramientas que aceleran el encaje
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground"
          {...fadeUp(0.15)}
        >
          Además de buscar y filtrar, Grantial aprende de ti y te ayuda a
          entender mejor cada oportunidad.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Swipe Card */}
        <motion.div
          className="overflow-hidden rounded-3xl bg-muted/40 p-7 sm:p-10"
          {...fadeUp(0)}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_200px] md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-100/70 dark:bg-violet-900/40 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-400">
                <Shuffle className="h-3.5 w-3.5" />
                Descubres oportunidades sin querer
              </span>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                Swipe de subvenciones
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                Un juego interactivo en el que vas definiendo tus gustos y las
                subvenciones que más te interesan. También te permite encontrar
                una subvención sin querer.
              </p>
              <div className="mt-6">
                <Link to="/swipe">
                  <Button className="group rounded-full bg-violet-600 px-6 text-white hover:bg-violet-700">
                    Probar Swipe
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Swipe mini mockup */}
            <div className="mx-auto w-full max-w-[200px] rounded-2xl bg-card p-3 shadow-sm">
              <div className="rounded-xl bg-gradient-to-b from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/30 p-3">
                <div className="h-2 w-12 rounded-full bg-violet-300/60" />
                <div className="mt-2 h-2 w-20 rounded-full bg-violet-200/60" />
                <div className="mt-6 flex items-center justify-between">
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-500">
                    No
                  </span>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-600">
                    Quizá
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    Sí
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2.5">
                <div className="h-8 w-8 rounded-full border border-rose-200 bg-rose-50" />
                <div className="h-9 w-9 rounded-full border border-violet-200 dark:border-violet-800 bg-card shadow-sm" />
                <div className="h-8 w-8 rounded-full border border-emerald-200 bg-emerald-50" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Granti Chat Card */}
        <motion.div
          className="overflow-hidden rounded-3xl bg-muted/40 p-7 sm:p-10"
          {...fadeUp(0.15)}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_200px] md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-100/70 dark:bg-violet-900/40 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-400">
                <MessageSquare className="h-3.5 w-3.5" />
                Tu sabelotodo de subvenciones
              </span>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                Chat con Granti
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                Habla con Granti, el sabelotodo de subvenciones. Puedes
                preguntarle lo que sea sobre una subvención concreta: requisitos,
                plazos, beneficiarios o encaje.
              </p>
              <div className="mt-6">
                <Link to="/subvenciones">
                  <Button
                    variant="outline"
                    className="group rounded-full border-border px-6 text-foreground hover:bg-muted"
                  >
                    Hablar con Granti
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Chat mini mockup */}
            <div className="mx-auto w-full max-w-[200px] rounded-2xl bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-white">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Granti</span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                  ¿Puedo pedirla con mi CIF?
                </div>
                <div className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-[11px] text-white">
                  Te resumo requisitos y plazos en segundos.
                </div>
                <div className="rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                  ¿Qué recibe el beneficiario?
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

/* ─── Calculator Section ──────────────────────────────────────────────── */

const CalculatorSection = () => (
  <section id="section-calculadora" className="scroll-mt-20 px-4 py-24 md:py-32">
    <div className="mx-auto max-w-4xl">
      <div className="mb-12 text-center">
        <motion.p
          className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600"
          {...fadeUp()}
        >
          Calculadora gratuita
        </motion.p>
        <motion.h2
          className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          {...fadeUp(0.1)}
        >
          ¿Cuánto dinero estás dejando escapar?
        </motion.h2>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground"
          {...fadeUp(0.15)}
        >
          Responde 4 preguntas y descubre cuántas subvenciones podrían encajar
          con tu empresa. Sin registro, sin compromiso.
        </motion.p>
      </div>

      <motion.div
        className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm"
        {...fadeUp(0.2)}
      >
        <CalculatorWidget embedded />
      </motion.div>
    </div>
  </section>
);

/* ─── Pricing Data ─────────────────────────────────────────────────────── */

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PricingFeature[];
  cta: string;
  ctaTo: string;
  highlighted?: boolean;
  dark?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    name: 'Gratis',
    price: '0€',
    period: '/mes',
    description: 'Prueba el tren. Descubre si hay subvenciones para ti.',
    features: [
      { text: '1 entidad', included: true },
      { text: 'Top 5 matches IA', included: true },
      { text: 'Marketplace completo', included: true },
      { text: 'Swipe ilimitado', included: true },
      { text: '5 mensajes/día con Granti', included: true },
      { text: 'Hasta 10 favoritos', included: true },
      { text: '1 alerta guardada', included: true },
      { text: 'Export Excel', included: false },
      { text: 'Documentos empresa', included: false },
      { text: 'BDNS (ayudas concedidas)', included: false },
    ],
    cta: 'Empezar gratis',
    ctaTo: '/auth',
  },
  {
    name: 'Pro',
    price: '29€',
    period: '/mes',
    description: 'Para quien busca subvenciones en serio.',
    highlighted: true,
    features: [
      { text: '3 entidades', included: true },
      { text: 'Todos los matches IA', included: true },
      { text: 'Marketplace completo', included: true },
      { text: 'Swipe ilimitado', included: true },
      { text: '15 mensajes/día con Granti', included: true },
      { text: 'Favoritos ilimitados', included: true },
      { text: '5 alertas + email semanal', included: true },
      { text: 'Export Excel', included: true },
      { text: 'Hasta 5 docs por entidad', included: true },
      { text: 'BDNS (ayudas concedidas)', included: true },
    ],
    cta: 'Empezar con Pro',
    ctaTo: '/auth',
  },
  {
    name: 'Premium',
    price: '79€',
    period: '/mes',
    description: 'Consultoras, gestorías y multi-entidad.',
    dark: true,
    features: [
      { text: 'Entidades ilimitadas', included: true },
      { text: 'Matches IA (umbral 70%)', included: true },
      { text: 'Marketplace completo', included: true },
      { text: 'Swipe ilimitado', included: true },
      { text: '50 mensajes/día con Granti', included: true },
      { text: 'Favoritos ilimitados', included: true },
      { text: 'Alertas ilimitadas + email diario', included: true },
      { text: 'Export Excel + pack BOE', included: true },
      { text: 'Documentos ilimitados', included: true },
      { text: 'BDNS + histórico completo', included: true },
    ],
    cta: 'Empezar con Premium',
    ctaTo: '/auth',
  },
];

/* ─── Pricing Section ─────────────────────────────────────────────────── */

const PricingSection = () => (
  <section id="section-precios" className="scroll-mt-20 px-4 pb-28 pt-10 sm:pb-36">
    <div className="mx-auto max-w-6xl">
      <div className="mb-14 text-center">
        <motion.p
          className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600"
          {...fadeUp()}
        >
          Empieza hoy
        </motion.p>
        <motion.h2
          className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          {...fadeUp(0.1)}
        >
          El tren no te espera.
          <span className="block text-muted-foreground">
            Elige tu billete.
          </span>
        </motion.h2>
        <motion.p
          className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
          {...fadeUp(0.2)}
        >
          Empieza gratis y sube de plan cuando lo necesites. Sin compromiso.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
        {pricingPlans.map((plan, i) => (
          <motion.div
            key={plan.name}
            className={`relative flex flex-col overflow-hidden rounded-3xl ${
              plan.dark
                ? 'bg-gray-950 text-white'
                : 'bg-card text-card-foreground'
            } ${
              plan.highlighted
                ? 'border-2 border-violet-500 shadow-xl shadow-violet-500/10 md:-mt-4 md:mb-[-16px]'
                : plan.dark
                  ? 'border border-gray-800'
                  : 'border border-border'
            }`}
            {...fadeUp(i * 0.1)}
          >
            {/* Popular badge */}
            {plan.highlighted && (
              <div className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white">
                <Star className="h-3.5 w-3.5 fill-current" />
                Más popular
              </div>
            )}

            <div className={`flex flex-1 flex-col p-7 sm:p-8 ${plan.highlighted ? '' : 'pt-8'}`}>
              {/* Plan name */}
              <p
                className={`text-sm font-semibold uppercase tracking-wider ${
                  plan.dark
                    ? 'text-violet-400'
                    : 'text-violet-600'
                }`}
              >
                {plan.name}
              </p>

              {/* Price */}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                  {plan.price}
                </span>
                <span
                  className={`text-sm ${
                    plan.dark ? 'text-gray-400' : 'text-muted-foreground'
                  }`}
                >
                  {plan.period}
                </span>
              </div>

              {/* Description */}
              <p
                className={`mt-3 text-sm leading-6 ${
                  plan.dark ? 'text-gray-400' : 'text-muted-foreground'
                }`}
              >
                {plan.description}
              </p>

              {/* Divider */}
              <div
                className={`my-6 h-px ${
                  plan.dark ? 'bg-gray-800' : 'bg-border'
                }`}
              />

              {/* Features list */}
              <ul className="flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          plan.dark
                            ? 'text-violet-400'
                            : plan.highlighted
                              ? 'text-violet-600'
                              : 'text-violet-500'
                        }`}
                      />
                    ) : (
                      <X
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          plan.dark ? 'text-gray-700' : 'text-muted-foreground/40'
                        }`}
                      />
                    )}
                    <span
                      className={`text-sm leading-5 ${
                        feature.included
                          ? plan.dark
                            ? 'text-gray-200'
                            : 'text-foreground'
                          : plan.dark
                            ? 'text-gray-600'
                            : 'text-muted-foreground/60'
                      }`}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <div className="mt-8">
                <Link to={plan.ctaTo} className="block">
                  <Button
                    size="lg"
                    className={`group w-full rounded-full text-sm font-semibold ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-700 hover:to-fuchsia-600'
                        : plan.dark
                          ? 'bg-white text-gray-950 hover:bg-gray-100'
                          : 'bg-foreground text-background hover:bg-foreground/90'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── Home Page ────────────────────────────────────────────────────────── */

const Home = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <TrainTrack />

      <main className="relative z-10">
        <HeroSection />
        <CalculatorSection />
        <MetaphorSection />
        <JourneySection />
        <ExtraFeaturesSection />
        <PricingSection />
      </main>

      <CookieConsent />
    </div>
  );
};

export default Home;
