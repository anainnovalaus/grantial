
import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import { Button } from '@/components/ui/button';
import { SendHorizontal, Search, ChevronDown, X, FileText, LoaderPinwheel } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

interface Grant {
  id: number;
  title: string;
}

interface ChatInputProps {
  onSend?: (content: string) => Promise<void>;
  disabled?: boolean;
  hideGrantSelector?: boolean;
  placeholder?: string;
}

const fetchGrants = async (): Promise<Grant[]> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_all_grants`);
    
    if (!response.ok) {
      throw new Error('Error al obtener subvenciones');
    }
    
    const data = await response.json();
    return data.grants || [];
  } catch (error) {
    console.error('Error fetching grants:', error);
    return [
      { id: 1, title: "Ayudas a la digitalización" },
      { id: 2, title: "Subvenciones para PYMEs" },
      { id: 3, title: "Fondo para innovación" }
    ];
  }
};

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, 
  disabled = false, 
  hideGrantSelector = false,
  placeholder = "Haz una pregunta sobre subvenciones..."
}) => {
  const chatContext = useChat();
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [showInputPopover, setShowInputPopover] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  const isLoading = disabled || (chatContext ? chatContext.isLoading : false);
  const isAssistantPage = location.pathname === '/assistant';
  const { clearMessages } = chatContext || {};

  const { data: grants = [], isLoading: isLoadingGrants } = useQuery<Grant[]>({
    queryKey: ['grantsFromDatabase'],
    queryFn: fetchGrants,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const handleFocusEffect = () => {
      if (textAreaRef.current) {
        setTimeout(() => {
          textAreaRef.current?.focus();
        }, 0);
      }
    };

    document.addEventListener('botIconClick', handleFocusEffect);
    
    return () => {
      document.removeEventListener('botIconClick', handleFocusEffect);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!textAreaRef.current) return;
    
    try {
      const textarea = textAreaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    } catch (error) {
      console.error('Error adjusting textarea height:', error);
    }
  }, [input]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: number;
    if (showInputPopover) {
      timer = window.setTimeout(() => {
        setShowInputPopover(false);
      }, 3000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showInputPopover]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedGrant) return;

    // Don't embed the grant in the message anymore
    const message = input;

    if (onSend) {
      await onSend(message);
    } else if (chatContext) {
      // Pass the selected grant title as a separate parameter
      await chatContext.sendMessage(message, undefined, selectedGrant?.title);
    }

    setInput('');
    
    try {
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error resetting textarea height:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    setSearchTerm('');
  };

  const handleSelectGrant = (grant: Grant) => {
    setSelectedGrant(grant);
    setIsOpen(false);
  };

  const clearSelectedGrant = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedGrant(null);
    return false;
  };

  const handleClearChat = () => {
    setIsClicked(true);
    if (clearMessages) {
      clearMessages();
    }
    
    // Reset the clicked state after animation completes
    setTimeout(() => {
      setIsClicked(false);
    }, 500);
  };

  // Fix for the null reference error - ensure we're filtering a valid array of grants
  // and safely accessing the title property
  const filteredGrants = grants.filter((grant: Grant) => {
    if (!grant || typeof grant.title !== 'string') return false;
    return searchTerm ? grant.title.toLowerCase().includes(searchTerm.toLowerCase()) : true;
  });

  return (
    <form 
      onSubmit={handleSubmit}
      className={`w-full mx-auto bg-gradient-to-t from-background/95 to-background/85 backdrop-blur-sm rounded-lg ${hideGrantSelector ? 'border border-primary/10' : 'border border-primary/20'} shadow-sm animate-slide-up`}
    >
      <div className={`relative flex items-center justify-center gap-2 p-2 ${hideGrantSelector ? 'flex-row' : 'flex-col md:flex-row'}`}>
        {!hideGrantSelector && (
          <div className="relative w-full md:w-auto" ref={dropdownRef}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={`h-10 gap-1 rounded-lg w-full md:w-auto ${selectedGrant ? 'bg-primary/10 text-foreground border-primary/20' : 'text-muted-foreground'}`}
                    onClick={toggleDropdown}
                  >
                    {selectedGrant ? (
                      <>
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="truncate max-w-28">{selectedGrant.title}</span>
                        <div 
                          onClick={clearSelectedGrant}
                          className="inline-flex cursor-pointer"
                        >
                          <X 
                            className="h-4 w-4 text-muted-foreground hover:text-foreground" 
                            aria-label="Eliminar selección"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        <span className="truncate max-w-28">Seleccionar subvención</span>
                        <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedGrant ? 'Cambiar subvención seleccionada' : 'Buscar subvenciones disponibles'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isOpen && (
              <div className="absolute left-0 md:left-auto bottom-full mb-2 p-2 w-full md:w-72 max-h-60 overflow-y-auto bg-background border border-primary/20 rounded-md shadow-md z-50">
                <div className="flex items-center gap-2 mb-2 bg-muted/20 rounded-md p-1">
                  <Search className="h-4 w-4 text-muted-foreground ml-2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar subvenciones..."
                    className="flex-1 bg-transparent border-none outline-none text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <X 
                      className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer mr-2" 
                      onClick={() => setSearchTerm('')}
                    />
                  )}
                </div>
                
                {isLoadingGrants ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Cargando subvenciones...
                  </div>
                ) : filteredGrants.length > 0 ? (
                  <ul className="space-y-1">
                    {filteredGrants.map((grant: Grant) => (
                      <li 
                        key={grant.id}
                        onClick={() => handleSelectGrant(grant)}
                        className="px-3 py-2 text-sm rounded-md hover:bg-primary/5 cursor-pointer transition-colors"
                      >
                        {grant.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No se encontraron subvenciones</div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center w-full bg-muted/30 hover:bg-muted/40 rounded-lg border border-primary/10 transition-colors">
          <textarea
            ref={textAreaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none max-h-32 px-4 py-2 rounded-lg border-none bg-transparent focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground/70 text-foreground/90"
            disabled={isLoading}
          />
          {isAssistantPage && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleClearChat}
                    size="icon"
                    className={`m-1 rounded-lg h-9 w-9 shrink-0 bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-300 ${isClicked ? 'scale-90' : ''}`}
                    aria-label="Limpiar chat"
                  >
                    <LoaderPinwheel 
                      className={`h-4 w-4 transition-all duration-300 ease-in-out hover:rotate-12 hover:scale-110 ${isClicked ? 'rotate-[720deg] scale-75' : ''}`} 
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Limpiar chat</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            type="submit"
            size="icon"
            className="m-1 rounded-lg h-9 w-9 shrink-0 bg-primary/90 hover:bg-primary transition-all duration-200"
            disabled={isLoading || !input.trim()}
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ChatInput;