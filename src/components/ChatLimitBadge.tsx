import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ChatLimitBadgeProps {
  remaining: number;
  total?: number;
}

export const ChatLimitBadge: React.FC<ChatLimitBadgeProps> = ({ 
  remaining, 
  total = 8 
}) => {
  // Determinar el color según mensajes restantes
  const getVariant = () => {
    if (remaining >= 6) return 'default'; // Verde
    if (remaining >= 3) return 'secondary'; // Amarillo
    return 'destructive'; // Rojo
  };

  const percentage = (remaining / total) * 100;

  return (
    <Badge 
      variant={getVariant()}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
    >
      <MessageSquare className="h-3 w-3" />
      <span>{remaining}/{total} preguntas</span>
      <div className="ml-1 w-12 h-1.5 bg-background/30 rounded-full overflow-hidden">
        <div 
          className="h-full bg-current transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Badge>
  );
};