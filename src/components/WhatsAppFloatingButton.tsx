import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WhatsAppFloatingButtonProps {
  onClick: () => void;
}

const WhatsAppFloatingButton: React.FC<WhatsAppFloatingButtonProps> = ({ onClick }) => {
  return (
    <div className="fixed right-6 bottom-32 md:bottom-6 z-40">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onClick}
              size="icon"
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl 
                       transition-all duration-300 hover:scale-105 animate-float"
              aria-label="Recibir alertas de subvenciones"
            >
              <span className="text-2xl" role="img" aria-label="Noticias y alertas">
                🗞️
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Alertas de subvenciones</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default WhatsAppFloatingButton;