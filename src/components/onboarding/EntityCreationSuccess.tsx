import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Building, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

interface EntityCreationSuccessProps {
  onComplete: () => void;
}

export const EntityCreationSuccess: React.FC<EntityCreationSuccessProps> = ({ onComplete }) => {
  const navigate = useNavigate();

  const handleViewProfile = async () => {
    await onComplete();
    navigate('/entities', { replace: true });
  };

  const handleExploreGrants = async () => {
    await onComplete();
    navigate('/subvenciones', { replace: true });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 260,
          damping: 20 
        }}
        className="relative"
      >
        <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl">
          <CheckCircle className="w-16 h-16 text-white" />
        </div>
        
        {/* Success pulse effect */}
        <motion.div
          className="absolute inset-0 w-32 h-32 bg-green-500/30 rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-4 max-w-2xl"
      >
        <h2 className="text-3xl font-bold text-foreground">
          ¡Entidad creada exitosamente!
        </h2>
        <p className="text-lg text-muted-foreground">
          Tu perfil empresarial está listo y Granti ha comenzado a trabajar
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-2xl space-y-4"
      >
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-6 rounded-lg border border-border/50">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-lg">Granti está trabajando en segundo plano</h3>
              <p className="text-sm text-muted-foreground">
                Nuestro asistente inteligente está analizando tu perfil empresarial y buscando 
                las mejores subvenciones que encajan con tu entidad. Este proceso puede tardar 
                entre <strong>15-20 minutos</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                📧 <strong>Te enviaremos un correo</strong> cuando hayamos completado el análisis 
                y tengamos tus primeras recomendaciones listas.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/30 p-4 rounded-lg border border-border/30">
            <div className="flex items-start space-x-3">
              <TrendingUp className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm mb-1">Swipe de Subvenciones</h4>
                <p className="text-xs text-muted-foreground">
                  Mientras tanto, usa nuestra herramienta Swipe como un "Tinder para subvenciones" 
                  y ayuda a Granti a entender qué tipo de ayudas te interesan más
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg border border-border/30">
            <div className="flex items-start space-x-3">
              <Building className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm mb-1">Tu Perfil Empresarial</h4>
                <p className="text-xs text-muted-foreground">
                  Revisa y completa la información de tu empresa para obtener recomendaciones 
                  aún más precisas
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-4 w-full max-w-md"
      >
        <Button
          onClick={handleViewProfile}
          variant="outline"
          size="lg"
          className="flex-1"
        >
          <Building className="w-5 h-5 mr-2" />
          Ver mi perfil
        </Button>
        
        <Button
          onClick={handleExploreGrants}
          size="lg"
          className="flex-1"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Explorar subvenciones
        </Button>
      </motion.div>
    </div>
  );
};
