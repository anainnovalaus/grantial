import React, { useRef, useEffect, useState } from 'react';
import { ChatProvider, useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import PromptSuggestions from '@/components/PromptSuggestions';
import { ChatLimitBadge } from '@/components/ChatLimitBadge';
import {
  HelpCircle, Search, FileText, Info, Shuffle, Target, Bot,
  Calendar, Users, ArrowUp, Loader2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HomeData {
  stats: {
    totalGrants: number;
    totalEntities: number;
    upcomingDeadlinesPercentage: number;
  };
  recentGrants: {
    id: string;
    title: string;
    amount: string;
    deadline: string;
  }[];
}

const ChatInterface = () => {
  const { messages, isLoading, remainingMessages, resetTime, refreshLimits } = useChat();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const [showBotPopover, setShowBotPopover] = useState(false);
  const [showChatBubble, setShowChatBubble] = useState(false);

  // Fetch current chat limits when component mounts
  useEffect(() => {
    if (user?.id) {
      refreshLimits(user.id);
    }
  }, [user?.id, refreshLimits]);

  const focusOnInput = () => {
    if (inputRef.current) {
      const botIcon = document.querySelector('.bot-icon');
      if (botIcon) {
        botIcon.classList.add('animate-pulse');
        setTimeout(() => {
          botIcon.classList.remove('animate-pulse');
          
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
          });
          
          setTimeout(() => {
            setShowBotPopover(true);
            const focusEvent = new CustomEvent('botIconClick');
            document.dispatchEvent(focusEvent);
            
            setTimeout(() => {
              setShowBotPopover(false);
            }, 4000);
          }, 2000);
        }, 500);
      }
    }
  };

  const handleBotClick = () => {
    setShowChatBubble(true);
    setTimeout(() => {
      setShowChatBubble(false);
    }, 4000);
  };

  return (
    <div className="flex h-full w-full bg-background md:pl-20">
      <div className="flex-1 flex">
        <main className="flex-1 overflow-hidden pb-24 md:pb-24 flex justify-center">
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
            <ScrollArea className="h-full w-full px-2 md:px-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center mx-auto pt-8">
                  <Popover open={showBotPopover} onOpenChange={setShowBotPopover}>
                    <PopoverTrigger asChild>
                      <div 
                        className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 
                                hover:bg-primary/20 transition-all duration-300 cursor-pointer 
                                hover:scale-110 hover:rotate-6 group"
                        onClick={focusOnInput}
                      >
                        <Bot className="h-8 w-8 text-primary bot-icon group-hover:animate-float" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="bg-primary text-primary-foreground border-primary p-3 z-50" 
                      side="top"
                    >
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <span className="text-sm font-medium">¡Hola! Soy Granti, tu asistente de subvenciones</span>
                      </div>
                    </PopoverContent>
                  </Popover>
                  
                  <h2 className="text-2xl font-semibold mb-6">Bienvenido al Asistente de Subvenciones</h2>
                  
                  {isLoadingHomeData ? (
                    <div className="w-full flex justify-center my-6">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                  ) : homeData && (
                    <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-8">
                      <Card className="p-4 flex flex-col items-center justify-center bg-primary/5 border-primary/20">
                        <FileText className="h-8 w-8 text-primary mb-2" />
                        <p className="text-2xl font-bold">{homeData.stats.totalGrants}</p>
                        <p className="text-sm text-muted-foreground">Subvenciones</p>
                      </Card>
                      <Card className="p-4 flex flex-col items-center justify-center bg-primary/5 border-primary/20">
                        <Users className="h-8 w-8 text-primary mb-2" />
                        <p className="text-2xl font-bold">{homeData.stats.totalEntities}</p>
                        <p className="text-sm text-muted-foreground">Entidades</p>
                      </Card>
                      <Card className="p-4 flex flex-col items-center justify-center bg-primary/5 border-primary/20">
                        <Calendar className="h-8 w-8 text-primary mb-2" />
                        <p className="text-2xl font-bold">{homeData.stats.upcomingDeadlinesPercentage}%</p>
                        <p className="text-sm text-muted-foreground">Plazos próximos</p>
                      </Card>
                    </div>
                  )}
                  
                  {homeData && homeData.recentGrants.length > 0 && (
                    <div className="w-full max-w-2xl mb-8">
                      <h3 className="text-lg font-medium mb-3 text-left flex items-center">
                        <ArrowUp className="h-5 w-5 text-primary mr-2" />
                        Subvenciones recientes
                      </h3>
                      <div className="space-y-3">
                        {homeData.recentGrants.map(grant => (
                          <Link to={`/grant/${grant.id}`} key={grant.id}>
                            <Card className="p-4 hover:bg-primary/5 transition-all border-primary/10 flex justify-between items-center">
                              <div className="text-left">
                                <h4 className="font-medium line-clamp-2">{grant.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Fecha límite: {grant.deadline}
                                </p>
                              </div>
                              <div className="text-right font-semibold text-primary">
                                {grant.amount}
                              </div>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <Link to="/subvenciones-compatibles" className="w-full max-w-2xl bg-gradient-to-r from-violet-600 to-purple-700 text-white dark:from-violet-500 dark:to-purple-600 rounded-xl p-4 flex items-start gap-3 transition-all hover:opacity-95 dark:hover:opacity-90 group shadow-md hover:shadow-lg mb-8">
                    <Target className="h-10 w-10 text-white" />
                    <div className="text-left">
                      <h3 className="font-medium text-white">Tus Subvenciones Compatibles</h3>
                      <p className="text-sm text-white/90">Visualiza las subvenciones que mejor encajan con tu perfil</p>
                    </div>
                  </Link>
                  
                  <Link to="/swipe" className="w-full max-w-2xl bg-primary/5 dark:bg-card border border-primary/10 dark:border-primary/20 rounded-xl p-4 flex items-start gap-3 transition-all hover:bg-primary/10 dark:hover:bg-primary/15 group shadow-sm mb-8">
                    <Shuffle className="h-10 w-10 text-primary" />
                    <div className="text-left">
                      <h3 className="font-medium text-foreground">Descubrir Subvenciones</h3>
                      <p className="text-sm text-muted-foreground">Evalúa subvenciones con un simple deslizamiento</p>
                    </div>
                  </Link>
                  
                  <div 
                    className="w-full max-w-2xl bg-background dark:bg-card border border-border rounded-lg p-4 shadow-sm flex items-start gap-1 mb-8 relative group cursor-pointer"
                    onClick={handleBotClick}
                  >
                      <Bot className="h-10 w-10 text-primary bot-icon group-hover:animate-float" />
                      <div className="text-left">
                        <h3 className="text-lg font-medium p-2">Habla con Granti</h3>
                        <p className="text-sm text-muted-foreground p-2">
                          Haz click en las sugerencias del panel derecho para empezar a chatear con el asistente,
                          o escribe tu pregunta directamente en el campo de texto.
                        </p>
                      </div>
                      
                      {showChatBubble && (
                        <div className="absolute -top-12 left-2 bg-primary text-primary-foreground rounded-lg p-3 shadow-md animate-fade-in">
                          <p className="text-sm font-medium whitespace-nowrap">¡Estoy esperando tu mensaje! 😊</p>
                          <div className="absolute -bottom-2 left-6 w-0 h-0 
                            border-l-[6px] border-r-[6px] border-t-[8px] 
                            border-l-transparent border-r-transparent border-t-primary"></div>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <ChatMessage 
                  key={message.id} 
                  message={message} 
                  isLatest={index === messages.length - 1} 
                />
              ))}
              
              <div ref={messagesEndRef} />
            </ScrollArea>
          </div>
        </main>

        <aside className="hidden lg:block w-80 shrink-0 border-l border-primary/10 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto py-6 px-4">
          <PromptSuggestions />
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:right-80 bg-gradient-to-t from-background to-transparent py-6 px-2 md:px-4 flex justify-center pb-20 md:pb-6" ref={inputRef}>
        <div className="w-full max-w-4xl mx-auto space-y-3">
          <div className="flex justify-center">
            <ChatLimitBadge remaining={remainingMessages} total={8} />
          </div>
          <ChatInput />
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  return (
    <ChatProvider>
      <ChatInterface />
    </ChatProvider>
  );
};

export default Index;