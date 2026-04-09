import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { Building, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Import onboarding step components
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';
import { AssistantStep } from '@/components/onboarding/AssistantStep';
import { SwipeStep } from '@/components/onboarding/SwipeStep';
import { MatchesStep } from '@/components/onboarding/MatchesStep';

interface ReadyToStartStepProps {
  onCompleteOnboarding?: () => void;
  isLoading?: boolean;
}

const ReadyToStartStep: React.FC<ReadyToStartStepProps> = ({
  onCompleteOnboarding,
  isLoading = false,
}) => {
  return (
    <div className="flex flex-col justify-center h-full space-y-8 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto shadow-lg">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <h2 className="text-2xl lg:text-3xl font-bold text-foreground">
          Ya está todo preparado para empezar
        </h2>
        <p className="text-sm lg:text-base text-muted-foreground max-w-2xl mx-auto">
          Ya conoces cómo funciona Grantial. Ahora crea tu entidad
          para que pueda empezar a encontrar subvenciones que encajen contigo.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="max-w-2xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <Card className="p-4 border-border/60 bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Siguiente paso</h3>
              <p className="text-xs text-muted-foreground">
                Ve a <strong>Entidades</strong> y crea tu entidad con Nombre y CIF.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/60 bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Después</h3>
              <p className="text-xs text-muted-foreground">
                Cuando completes la entidad, Granti podrá empezar a recomendarte subvenciones compatibles.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex justify-center"
      >
        <Button
          size="lg"
          onClick={onCompleteOnboarding}
          disabled={isLoading}
          className="min-w-[220px]"
        >
          <Building className="w-4 h-4 mr-2" />
          Crear Mi Entidad
        </Button>
      </motion.div>
    </div>
  );
};

const ONBOARDING_STEPS = [
  { id: 'welcome', component: WelcomeStep },
  { id: 'assistant', component: AssistantStep },
  { id: 'swipe', component: SwipeStep },
  { id: 'matches', component: MatchesStep },
  { id: 'ready', component: ReadyToStartStep },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await completeOnboarding();
      return true;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
      return false;
    }
  };

  const handleCompleteAndGoToEntities = async () => {
    const success = await handleComplete();
    if (success) {
      navigate('/entities', { replace: true });
    }
  };

  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const CurrentStepComponent = ONBOARDING_STEPS[currentStep].component;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <div className="h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex flex-col p-2 overflow-hidden">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="text-center mb-2 flex-shrink-0">
          <h1 className="text-lg lg:text-xl font-bold text-foreground mb-1">
            ¡Bienvenido a Grantial, {user?.name}!
          </h1>
          <p className="text-muted-foreground text-xs lg:text-sm">
            En 2 minutos empezamos a encontrar subvenciones para ti
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-2 flex-shrink-0">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-muted-foreground">
              Paso {currentStep + 1} de {ONBOARDING_STEPS.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(progress)}% completado
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Step Content */}
        <Card className="flex-1 p-2 lg:p-4 mb-2 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <CurrentStepComponent 
                onNext={handleNext}
                onEntityCreated={undefined}
                onCompleteOnboarding={isLastStep ? handleCompleteAndGoToEntities : undefined}
                isLoading={isCompleting}
              />
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Navigation */}
        {!isLastStep && (
          <div className="flex justify-between items-center flex-shrink-0">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="min-w-[80px] text-xs"
              size="sm"
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Anterior
            </Button>

            <div className="flex space-x-1">
              {ONBOARDING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              disabled={currentStep === ONBOARDING_STEPS.length - 1}
              className="min-w-[80px] text-xs"
              size="sm"
            >
              Siguiente
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
