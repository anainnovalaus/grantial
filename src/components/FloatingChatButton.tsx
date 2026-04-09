
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({ onClick, isOpen }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <Button
        onClick={handleClick}
        size={isOpen ? "icon" : "sm"}
        className={`shadow-lg hover:shadow-xl bg-purple-600 hover:bg-purple-700 transition-all duration-300 ${
          isOpen ? "h-14 w-14 rounded-full" : "h-12 rounded-full px-4"
        }`}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
      >
        {isOpen ? (
          <span className="text-lg font-bold">✕</span>
        ) : (
          <span className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Habla con Granti</span>
          </span>
        )}
      </Button>
    </div>
  );
};

export default FloatingChatButton;
