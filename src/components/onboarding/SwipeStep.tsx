import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, X, TrendingUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SwipeStepProps {
  onNext: () => void;
}

export const SwipeStep: React.FC<SwipeStepProps> = ({ onNext }) => {
  const [currentCard, setCurrentCard] = useState(0);
  const [showDemo, setShowDemo] = useState(false);

  const demoCards = [
    {
      title: "NEOTEC 2024",
      organization: "CDTI",
      amount: "Hasta 250.000€",
      description: "Subvención para empresas de base tecnológica",
      deadline: "15 Dic 2024"
    },
    {
      title: "Digital Kit",
      organization: "Red.es",
      amount: "Hasta 12.000€",
      description: "Ayudas para digitalización de PYMES",
      deadline: "31 Mar 2025"
    }
  ];

  const handleSwipeDemo = (direction: 'like' | 'pass') => {
    if (currentCard < demoCards.length - 1) {
      setCurrentCard(currentCard + 1);
    } else {
      setShowDemo(false);
      setCurrentCard(0);
    }
  };

  return (
    <div className="flex flex-col justify-center h-full space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto">
          <TrendingUp className="w-10 h-10 text-primary-foreground" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">
          +100.000 subvenciones al año.
          <br />
          <span className="text-primary">Alguna es para ti.</span>
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Grantify te ayuda a descubrir qué subvenciones te interesan y aprende de tus decisiones para afinar recomendaciones.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-green-700 dark:text-green-400">
                Me interesa →
              </h3>
              <p className="text-muted-foreground">
                Desliza a la derecha y la guardamos para ti. Te avisamos de plazos y novedades.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-red-700 dark:text-red-400">
                ← No es para mí
              </h3>
              <p className="text-muted-foreground">
                Desliza a la izquierda y aprendemos de tus preferencias para afinar las próximas recomendaciones.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Cada swipe te acerca más</h3>
              <p className="text-muted-foreground">
                Cuanto más uses Grantial, mejor te conocemos y más precisas serán tus recomendaciones. Tú ganas.
              </p>
            </div>
          </div>

          {!showDemo && (
            <Button
              onClick={() => setShowDemo(true)}
              variant="outline"
              className="w-full"
            >
              Prueba el swipe ahora
            </Button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative"
        >
          {showDemo ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground mb-4">
                Así de fácil es decidir:
              </p>

              <div className="relative h-64 flex items-center justify-center">
                <Card className="w-full max-w-sm p-6 bg-gradient-to-br from-card to-card/80 border border-border/50">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-lg">{demoCards[currentCard].title}</h3>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {demoCards[currentCard].organization}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-2xl font-bold text-primary">
                        {demoCards[currentCard].amount}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {demoCards[currentCard].description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Plazo: {demoCards[currentCard].deadline}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex justify-center space-x-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleSwipeDemo('pass')}
                  className="w-16 h-16 rounded-full border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  <X className="w-6 h-6 text-red-600" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleSwipeDemo('like')}
                  className="w-16 h-16 rounded-full border-green-200 hover:bg-green-50 hover:border-green-300"
                >
                  <Heart className="w-6 h-6 text-green-600" />
                </Button>
              </div>
            </div>
          ) : (
            <Card className="w-full max-w-sm mx-auto p-5 bg-gradient-to-br from-card to-card/80 border border-border/50">
              <div className="space-y-3">
                <p className="text-sm font-medium text-center">Verás tarjetas como esta</p>
                <div className="rounded-lg border border-border/50 p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold">Subvención ejemplo</h3>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded">
                      Match
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Desliza a la derecha si te interesa y a la izquierda si no encaja.
                  </p>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Pulsa en “Prueba el swipe ahora” para ver una demo interactiva.
                </p>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};
