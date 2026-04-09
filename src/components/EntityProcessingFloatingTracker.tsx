import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Maximize2, Minimize2, Sparkles, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  clearEntityProcessingTrackerState,
  ENTITY_PROCESSING_TRACKER_EVENT,
  getEntityProcessingTrackerState,
  setEntityProcessingTrackerState,
  type EntityProcessingTrackerState,
} from '@/utils/entityProcessingTracker';

const apiUrl = import.meta.env.VITE_API_URL;

interface ProcessingStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  stage: string;
  message: string;
  progress: number;
  processed_items: number;
  total_items: number;
  matches_found: number;
  best_match_score: number | null;
  first_high_match: {
    grant_id: string | null;
    score: number | null;
  } | null;
  error: string | null;
}

const EntityProcessingFloatingTracker: React.FC = () => {
  const navigate = useNavigate();
  const [trackerState, setTrackerState] = useState<EntityProcessingTrackerState | null>(
    getEntityProcessingTrackerState(),
  );
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false);
  const [hasNotifiedError, setHasNotifiedError] = useState(false);

  useEffect(() => {
    const syncTrackerState = () => setTrackerState(getEntityProcessingTrackerState());
    window.addEventListener(ENTITY_PROCESSING_TRACKER_EVENT, syncTrackerState as EventListener);
    window.addEventListener('storage', syncTrackerState);
    return () => {
      window.removeEventListener(ENTITY_PROCESSING_TRACKER_EVENT, syncTrackerState as EventListener);
      window.removeEventListener('storage', syncTrackerState);
    };
  }, []);

  useEffect(() => {
    setStatus(null);
    setHasNotifiedComplete(false);
    setHasNotifiedError(false);
  }, [trackerState?.entityId]);

  useEffect(() => {
    if (!trackerState?.entityId) return;

    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const response = await fetch(`${apiUrl}/api/entity_processing_status?entity_id=${trackerState.entityId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const payload = await response.json();
        if (!payload?.success || !payload?.status) return;

        const nextStatus: ProcessingStatus = payload.status;
        setStatus(nextStatus);

        if (nextStatus.first_high_match && !trackerState.openedHighMatch) {
          const score = nextStatus.first_high_match.score != null
            ? Math.round(nextStatus.first_high_match.score * 100)
            : 85;
          toast.success(`¡Match de ${score}% detectado!`, {
            description: 'Te llevamos a tus subvenciones compatibles y dejamos el tracker minimizado.',
          });
          setEntityProcessingTrackerState({
            ...trackerState,
            minimized: true,
            openedHighMatch: true,
          });
          navigate('/subvenciones-compatibles');
          return;
        }

        if (nextStatus.status === 'completed' && !hasNotifiedComplete) {
          setHasNotifiedComplete(true);
          toast.success('Proceso finalizado', {
            description: 'Ya tienes disponibles todos los matches. También recibirás el correo resumen.',
          });
        }

        if (nextStatus.status === 'error' && !hasNotifiedError) {
          setHasNotifiedError(true);
          toast.error(nextStatus.message || 'Hubo un error en el procesamiento');
        }
      } catch (pollError) {
        console.error('Error en polling de entity processing tracker:', pollError);
      }
    };

    pollStatus();
    const intervalId = window.setInterval(pollStatus, 4000);
    return () => window.clearInterval(intervalId);
  }, [hasNotifiedComplete, hasNotifiedError, navigate, trackerState]);

  if (!trackerState?.entityId) return null;

  const progress = Math.max(0, Math.min(100, status?.progress ?? 0));
  const stage = status?.stage || 'queued';
  const isCompleted = status?.status === 'completed';
  const isErrored = status?.status === 'error';

  const closeTracker = () => {
    clearEntityProcessingTrackerState();
    setStatus(null);
    setCloseConfirmOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[80]">
        {trackerState.minimized ? (
          <div className="w-80 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isErrored ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span>{isCompleted ? 'Proceso completado' : isErrored ? 'Proceso con error' : 'Analizando entidad'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => setEntityProcessingTrackerState({ ...trackerState, minimized: false })}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => setCloseConfirmOpen(true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(progress)}%</span>
              <span>
                {(status?.processed_items || 0)}
                {status?.total_items ? ` / ${status.total_items}` : ''} revisadas
              </span>
            </div>
          </div>
        ) : (
          <div className="w-[360px] rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">
                  {isCompleted ? 'Proceso finalizado' : isErrored ? 'Proceso detenido' : 'Procesando entidad'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {status?.message || 'Analizando scraping y matching en segundo plano.'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => setEntityProcessingTrackerState({ ...trackerState, minimized: true })}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => setCloseConfirmOpen(true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Progress value={progress} className="h-3" />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Progreso: {Math.round(progress)}%</span>
              <span>{status?.matches_found || 0} matches creados</span>
            </div>

            <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>Etapa actual: <span className="font-medium text-foreground">{stage}</span></p>
              <p>
                Subvenciones revisadas: <span className="font-medium text-foreground">
                  {status?.processed_items || 0}
                  {status?.total_items ? ` / ${status.total_items}` : ''}
                </span>
              </p>
              <p>Seguimos investigando más de 8.000 subvenciones mientras navegas.</p>
            </div>

            {status?.first_high_match && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Subvención detectada con alta compatibilidad
                </div>
                <p className="text-xs text-muted-foreground">
                  Compatibilidad estimada:
                  {' '}
                  {status.first_high_match.score != null
                    ? `${Math.round(status.first_high_match.score * 100)}%`
                    : '>= 85%'}
                </p>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => navigate('/subvenciones-compatibles')}
                >
                  Ver subvenciones compatibles
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar el seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              El procesamiento seguirá ejecutándose en segundo plano, pero dejarás de ver la barra de progreso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={closeTracker}
            >
              Cerrar seguimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EntityProcessingFloatingTracker;
