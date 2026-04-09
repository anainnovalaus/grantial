import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MatchesStepProps {
  onNext: () => void;
}

export const MatchesStep: React.FC<MatchesStepProps> = ({ onNext }) => {
  return (
    <div className="flex flex-col justify-center h-full space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto">
          <Target className="w-10 h-10 text-primary-foreground" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">
          Cuanto más te conozca,
          <br />
          <span className="text-primary">más subvenciones te encontraré</span>
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-4 max-w-3xl mx-auto w-full"
      >
        <div className="text-center mb-4">
          <h3 className="font-semibold text-lg mb-2">Así verás tus matches</h3>
          <p className="text-sm text-muted-foreground">
            Solo subvenciones relevantes, ordenadas por compatibilidad
          </p>
        </div>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-50/50 border-green-200 dark:from-green-950/30 dark:to-green-950/10 dark:border-green-800">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-200">NEOTEC 2024</h4>
              <p className="text-sm text-green-600 dark:text-green-400">CDTI</p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              95% compatible
            </Badge>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 mb-2">
            Financiación para empresas de base tecnológica
          </p>
          <div className="flex justify-between text-xs text-green-600 dark:text-green-400">
            <span>Hasta 250.000€</span>
            <span>Plazo: 15 días</span>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-50/50 border-blue-200 dark:from-blue-950/30 dark:to-blue-950/10 dark:border-blue-800">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">Digital Kit</h4>
              <p className="text-sm text-blue-600 dark:text-blue-400">Red.es</p>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              87% compatible
            </Badge>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
            Ayudas para digitalización de PYMES
          </p>
          <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
            <span>Hasta 12.000€</span>
            <span>Plazo: 45 días</span>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="text-center"
      >
        <p className="text-muted-foreground font-medium">
          Ya está todo listo. Al finalizar el onboarding te llevaremos a <strong>Entities</strong> para crear tu entidad.
        </p>
      </motion.div>
    </div>
  );
};
