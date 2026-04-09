import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building, Globe, FileText, Search, User, CheckCircle, Loader2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface Stage {
  label: string;
  icon: React.ElementType;
  progress: number;
  duration: number;
}

interface EntityCreationProgressProps {
  hasWebsite?: boolean;
  hasFiles?: boolean;
  onComplete?: () => void;
}

export const EntityCreationProgress: React.FC<EntityCreationProgressProps> = ({ 
  hasWebsite = false,
  hasFiles = false,
  onComplete 
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);

  const stages: Stage[] = useMemo(() => [
    {
      label: 'Validando información empresarial...',
      icon: Building,
      progress: 15,
      duration: 4000,
    },
    ...(hasWebsite ? [{
      label: 'Analizando página web...',
      icon: Globe,
      progress: 35,
      duration: 3000,
    }] : []),
    ...(hasFiles ? [{
      label: 'Procesando documentos...',
      icon: FileText,
      progress: 55,
      duration: 5000,
    }] : []),
    {
      label: 'Buscando más datos de la entidad...',
      icon: Search,
      progress: 85,
      duration: 6000,
    },
    {
      label: 'Configurando tu perfil personalizado...',
      icon: User,
      progress: 95,
      duration: 4000,
    },
    {
      label: '¡Listo! Redirigiendo...',
      icon: CheckCircle,
      progress: 100,
      duration: 2000,
    },
  ], [hasWebsite, hasFiles]);

  useEffect(() => {
    const totalDuration = stages.reduce((sum, stage) => sum + stage.duration, 0);
    const avgDuration = totalDuration / stages.length;

    const stageInterval = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < stages.length - 1) {
          return prev + 1;
        } else if (prev === stages.length - 1 && onComplete) {
          // Call onComplete when we reach the last stage
          setTimeout(() => onComplete(), 1000);
        }
        return prev;
      });
    }, avgDuration);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const targetProgress = stages[currentStage]?.progress || 0;
        if (prev < targetProgress) {
          return Math.min(prev + 1, targetProgress);
        }
        return prev;
      });
    }, 100);

    return () => {
      clearInterval(stageInterval);
      clearInterval(progressInterval);
    };
  }, [currentStage, stages, onComplete]);

  const CurrentIcon = stages[currentStage]?.icon || Loader2;
  const estimatedTime = Math.max(
    Math.ceil((stages.reduce((sum, stage) => sum + stage.duration, 0) * (1 - progress / 100)) / 1000),
    1
  );

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-6 w-full max-w-md"
      >
        {/* Icon */}
        <div className="relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-full flex items-center justify-center shadow-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStage}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <CurrentIcon className="w-12 h-12 text-primary-foreground" />
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Pulse effect */}
          <motion.div
            className="absolute inset-0 w-24 h-24 mx-auto bg-primary/20 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Stage text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-2"
          >
            <h3 className="text-xl font-semibold text-foreground">
              {stages[currentStage]?.label}
            </h3>
            <p className="text-sm text-muted-foreground">
              Tiempo estimado: {estimatedTime} segundo{estimatedTime !== 1 ? 's' : ''}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="space-y-2 w-full">
          <Progress 
            value={progress} 
            className="h-2.5"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Progreso</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Stage indicators */}
        <div className="flex justify-center items-center space-x-2">
          {stages.map((_, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0 }}
              animate={{ 
                scale: 1,
                backgroundColor: index <= currentStage 
                  ? 'hsl(var(--primary))' 
                  : 'hsl(var(--muted))'
              }}
              transition={{ duration: 0.3 }}
              className="w-2 h-2 rounded-full"
            />
          ))}
        </div>

        {/* Additional info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-muted/30 p-4 rounded-lg border border-border/30"
        >
          <p className="text-xs text-muted-foreground">
            💡 Este proceso puede tardar un poco mientras analizamos toda la información y buscamos las mejores subvenciones para ti
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};
