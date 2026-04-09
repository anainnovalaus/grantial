import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, HelpCircle, Calendar, ClipboardList, ArrowUpRightSquare, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useParams } from 'react-router-dom';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import { ChatLimitBadge } from './ChatLimitBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FloatingGrantAssistantProps {
  onClose: () => void;
  grantTitle: string;
  grantAmount: string;
  grantDeadline: string;
  grantDescription: string;
}

const FloatingGrantAssistant: React.FC<FloatingGrantAssistantProps> = ({
  onClose,
  grantTitle,
  grantAmount,
  grantDeadline,
  grantDescription
}) => {
  const { messages, sendMessage, isLoading, clearMessages, remainingMessages, resetTime, refreshLimits } = useChat();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { id } = useParams<{ id: string }>();
  const [initialized, setInitialized] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [connectionRetries, setConnectionRetries] = useState(0);
  const maxRetries = 3;

  // Fetch current chat limits when component mounts
  useEffect(() => {
    if (user?.id) {
      refreshLimits(user.id);
    }
  }, [user?.id, refreshLimits]);

  useEffect(() => {
    if (!initialized) {
      clearMessages();
      setInitialized(true);
    }
  }, [clearMessages, initialized]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string): Promise<void> => {
    if (content.trim() && remainingMessages > 0) {
      try {
        if (id) {
          await sendMessage(content, user?.id, { id, title: grantTitle });
        } else {
          await sendMessage(content, user?.id, grantTitle);
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setApiError(true);
      }
      return Promise.resolve();
    }
    return Promise.resolve();
  };

  const visibleMessages = messages.filter(msg => 
    msg.role !== 'system' && 
    !msg.content.includes('[SYSTEM INFO]')
  );

  const quickActionTopics = [
    { icon: <ClipboardList className="h-4 w-4" />, text: "Requisitos" },
    { icon: <Calendar className="h-4 w-4" />, text: "Plazos" },
    { icon: <ArrowUpRightSquare className="h-4 w-4" />, text: "Proceso" },
  ];

  const hasApiErrorMessage = visibleMessages.some(msg => 
    msg.role === 'assistant' && msg.content.includes('No se pudo conectar con el asistente')
  );

  if (hasApiErrorMessage) {
    setApiError(false);
  }

  return (
    <Card className="w-[500px] max-w-[90vw] h-[650px] flex flex-col overflow-hidden shadow-lg border-primary/20 animate-slide-in-right bg-card">
      <div className="flex items-center justify-between border-b p-3 bg-card">
        <div className="flex items-center gap-2">
          <Bot className="h-8 w-8 text-primary bot-icon " />
          <div className="flex flex-col">
            <h3 className="font-medium text-mg">Habla con Granti</h3>
            <ChatLimitBadge remaining={remainingMessages} total={8} />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {apiError && visibleMessages.length === 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error de conexión</AlertTitle>
            <AlertDescription>
              No se pudo conectar con el servidor del asistente.
            </AlertDescription>
          </Alert>
        )}
      
        {visibleMessages.length === 0 && !isLoading && !apiError ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            
            <h3 className="text-center font-medium text-lg mb-2">
              ¿En qué puedo ayudarte con la subvención
            </h3>
            <p className="text-center font-semibold text-primary mb-4">
              "{grantTitle}"?
            </p>
            
            <div className="w-full max-w-xs bg-muted/90 rounded-lg p-4 mb-4 rounded-full">
              <p className="text-center text-sm text-muted-foreground">
                Puedes preguntar sobre cualquier duda específica.
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
              {quickActionTopics.map((topic, index) => (
                <button 
                  key={index}
                  onClick={() => handleSendMessage(`Información sobre ${topic.text.toLowerCase()} de esta subvención`)}
                  className="flex flex-col items-center justify-center p-2 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                    {topic.icon}
                  </div>
                  <span className="text-xs">{topic.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message}
              isLatest={message.id === visibleMessages[visibleMessages.length - 1]?.id}
              textSize="sm"
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t bg-background">
        {remainingMessages === 0 ? (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground">
              Has alcanzado el límite diario de 8 preguntas.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Se reseteará mañana a las {resetTime}
            </p>
          </div>
        ) : (
          <ChatInput 
            onSend={handleSendMessage} 
            disabled={isLoading || apiError || remainingMessages === 0} 
            hideGrantSelector={true} 
            placeholder={
              apiError 
                ? "Servidor no disponible..." 
                : remainingMessages <= 2
                  ? `Solo ${remainingMessages} pregunta${remainingMessages > 1 ? 's' : ''} restante${remainingMessages > 1 ? 's' : ''}...`
                  : "Pregunta sobre esta subvención..."
            }
          />
        )}
      </div>
    </Card>
  );
};

export default FloatingGrantAssistant;
