import React from 'react';
import { motion } from 'framer-motion';
import { Train } from 'lucide-react';

interface AssistantStepProps {
  onNext: () => void;
}

export const AssistantStep: React.FC<AssistantStepProps> = ({ onNext }) => {
  return (
    <div className="flex flex-col justify-center h-full space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto">
          <Train className="w-10 h-10 text-primary-foreground" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">
          Las subvenciones son como trenes
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Pasan una vez. Si no las coges, las pierdes.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="max-w-3xl mx-auto w-full bg-gradient-to-br from-card to-card/50 p-6 rounded-xl border border-border/50"
      >
        <div className="space-y-5">
          <div className="text-center space-y-2 pb-4 border-b border-border/30">
            <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">Sin Grantify</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className="text-red-500">✗</span>
                <span>Buscas manualmente entre miles de convocatorias</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className="text-red-500">✗</span>
                <span>Te enteras tarde o nunca de las oportunidades</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span className="text-red-500">✗</span>
                <span>No sabes si una subvención es para ti</span>
              </div>
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-primary uppercase tracking-wide font-medium">Con Grantify</p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Te avisamos de cada subvención que encaja contigo</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Siempre a tiempo, antes de que cierre el plazo</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Sabes exactamente por qué encaja con tu empresa</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="text-center"
      >
        <p className="text-muted-foreground font-medium">
          No dejes que tu próxima subvención se vaya sin ti.
        </p>
      </motion.div>
    </div>
  );
};
