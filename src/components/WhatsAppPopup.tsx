import React from 'react';
import { X, MessageCircle, Clock, Zap, Users, Euro, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface WhatsAppPopupProps {
  onClose: () => void;
  isOpen: boolean;
}

const WhatsAppPopup: React.FC<WhatsAppPopupProps> = ({ onClose, isOpen }) => {
  const handleWhatsAppJoin = () => {
    // Placeholder WhatsApp link - to be replaced with actual channel link
    const whatsappLink = "https://chat.whatsapp.com/I4zqIE0Hdwm1wyFRdx6qna?mode=wwc";
    window.open(whatsappLink, '_blank');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <Card className="w-full max-w-md bg-card border shadow-lg animate-scale-in">
        <CardHeader className="pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="text-center space-y-3 pr-8">
            <div className="text-3xl">🗞️</div>
            <h2 className="text-xl font-semibold text-foreground">
              Canal de alertas de subvenciones
            </h2>
            <p className="text-sm text-muted-foreground">
              Recibe notificaciones tempranas sobre nuevas oportunidades de financiación
            </p>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <Clock className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">Alertas antes de la publicación oficial</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <Euro className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">Información sobre requisitos y plazos</span>
            </div>

          </div>
          
          {/* CTA Buttons */}
          <div className="pt-2 space-y-3">
            <Button 
              onClick={handleWhatsAppJoin}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Unirse al canal
            </Button>
            
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full text-muted-foreground hover:text-foreground text-sm"
            >
              Quizás más tarde
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppPopup;