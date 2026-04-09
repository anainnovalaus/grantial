import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Euro, Clock } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative"
      >
        <div className="w-32 h-32 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mb-8">
          <Sparkles className="w-16 h-16 text-primary-foreground" />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full opacity-60"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-4 max-w-2xl"
      >
        <h2 className="text-4xl font-bold text-foreground">
          Encuentra <span className="text-primary">TUS</span> subvenciones
        </h2>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Olvídate de perder tiempo buscando entre miles de convocatorias. Granti te trae solo las que encajan contigo.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl"
      >
        <div className="bg-card/50 backdrop-blur-sm p-6 rounded-lg border border-border/50">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Euro className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Dinero que te pertenece</h3>
          <p className="text-sm text-muted-foreground">
            Hay subvenciones esperándote.
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-sm p-6 rounded-lg border border-border/50">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Sin perder ni un minuto</h3>
          <p className="text-sm text-muted-foreground">
            Olvídate de buscar entre miles de convocatorias.
          </p>
        </div>

      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="text-muted-foreground"
      >
        En 2 minutos te enseñamos cómo funciona y después crearás tu entidad en la sección Entities
      </motion.p>
    </div>
  );
};
