
import React, { useState } from 'react';
import { LoaderPinwheel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/context/ChatContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FloatingButtonProps {
  onClick?: () => void;
}

const FloatingButton: React.FC<FloatingButtonProps> = ({ onClick }) => {
  const { clearMessages } = useChat();
  const [isClicked, setIsClicked] = useState(false);

  const handleNewChat = () => {
    setIsClicked(true);
    clearMessages();
    
    // Reset the clicked state after animation completes
    setTimeout(() => {
      setIsClicked(false);
    }, 500);
    
    if (onClick) onClick();
  };

  return (
    <div className="fixed right-6 bottom-20 md:bottom-6 z-10">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleNewChat}
              size="icon"
              className={`h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg 
                       transition-all duration-300 group ${isClicked ? 'scale-90' : ''}`}
              aria-label="Limpiar chat"
            >
              <LoaderPinwheel 
                className={`h-6 w-6 text-white transition-all duration-300 ease-in-out 
                        group-hover:rotate-12 group-hover:scale-110 
                        ${isClicked ? 'rotate-[720deg] scale-75' : ''}`} 
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Limpiar chat</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default FloatingButton;
