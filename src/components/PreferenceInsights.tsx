import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, MapPin, RotateCcw, Target, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { type SwipeDecision, type HistoricalInsights, aggregatePreferences, generateSummaryText, type FrequencyEntry } from '@/lib/preferenceInsights';

interface PreferenceInsightsProps {
  swiped: SwipeDecision[];
  historical?: HistoricalInsights | null;
  onResetInterests?: () => Promise<void> | void;
  isResettingInterests?: boolean;
}

const CategorySection = ({
  icon: Icon,
  label,
  entries
}: {
  icon: React.ElementType;
  label: string;
  entries: FrequencyEntry[];
}) => {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((entry, i) => (
          <Badge
            key={entry.value}
            variant={i === 0 ? 'secondary' : 'outline'}
            className={i === 0 ? 'font-semibold' : 'font-normal'}
          >
            {entry.value} ({entry.count})
          </Badge>
        ))}
      </div>
    </div>
  );
};

const PreferenceInsights = ({
  swiped,
  historical,
  onResetInterests,
  isResettingInterests = false,
}: PreferenceInsightsProps) => {
  const aggregation = useMemo(() => aggregatePreferences(swiped, historical), [swiped, historical]);
  const summaryText = useMemo(() => generateSummaryText(aggregation), [aggregation]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmationStep, setResetConfirmationStep] = useState<1 | 2>(1);

  if (aggregation.totalLikes < 3) return null;

  const showBadges = aggregation.totalLikes >= 5;
  const handleResetDialogChange = (open: boolean) => {
    setShowResetDialog(open);

    if (!open) {
      setResetConfirmationStep(1);
    }
  };

  const handleResetInterests = async () => {
    if (!onResetInterests) return;

    await onResetInterests();
    handleResetDialogChange(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-4 w-full xl:mt-0"
      >
        <Card className="w-full shadow-md border border-border">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-foreground text-sm">Tu perfil de intereses</h3>
              </div>
              {onResetInterests ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => handleResetDialogChange(true)}
                  disabled={isResettingInterests}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  {isResettingInterests ? 'Reseteando...' : 'Reset'}
                </Button>
              ) : null}
            </div>

            {summaryText && (
              <p
                className="text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: summaryText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
                }}
              />
            )}

            {showBadges && (
              <>
                <Separator className="my-3" />
                <div className="space-y-3">
                  <CategorySection
                    icon={Building2}
                    label="Beneficiarios"
                    entries={aggregation.beneficiarios}
                  />
                  <CategorySection
                    icon={MapPin}
                    label="Regiones"
                    entries={aggregation.regiones}
                  />
                  <CategorySection
                    icon={Target}
                    label="Finalidad"
                    entries={aggregation.finalidades}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={showResetDialog} onOpenChange={handleResetDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {resetConfirmationStep === 1 ? 'Resetear intereses' : 'Confirmación final'}
              </DialogTitle>
              <DialogDescription>
                {resetConfirmationStep === 1
                  ? 'Esto eliminará el historial de intereses usado para personalizar tus recomendaciones.'
                  : 'Vas a borrar tus intereses guardados y el sistema dejará de usar estas señales para recomendar subvenciones hasta que vuelvas a hacer swipe.'}
              </DialogDescription>
            </DialogHeader>
            {resetConfirmationStep === 2 ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
                Se eliminarán tus preferencias persistidas de la base de datos y el perfil de intereses se reconstruirá desde cero con tus siguientes decisiones.
              </div>
            ) : null}
            <DialogFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleResetDialogChange(false)} disabled={isResettingInterests}>
                Cancelar
              </Button>
              {resetConfirmationStep === 1 ? (
                <Button
                  variant="destructive"
                  onClick={() => setResetConfirmationStep(2)}
                  disabled={isResettingInterests}
                >
                  Continuar
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => void handleResetInterests()} disabled={isResettingInterests}>
                  {isResettingInterests ? 'Reseteando...' : 'Sí, resetear intereses'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AnimatePresence>
  );
};

export default PreferenceInsights;
