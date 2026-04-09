
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Building, Bot, Loader2 } from 'lucide-react';
import { MessageRole } from '@/context/ChatContext';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface ChatMessageProps {
  message: Message;
  isLatest: boolean;
  textSize?: "xs" | "sm" | "base";
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLatest, textSize = "base" }) => {
  const messageRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isLatest && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isLatest, message.content]);

  const isUser = message.role === 'user';
  
  // Formatear la hora en formato 24h (HH:MM)
  const formattedTime = `${message.timestamp.getHours().toString().padStart(2, '0')}:${message.timestamp.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div
      ref={messageRef}
      className={cn(
        "flex w-full my-8 animate-fade-in justify-center"
      )}
    >
      <div className="w-full max-w-3xl px-4">
        <div
          className={cn(
            "flex",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "flex max-w-[85%] md:max-w-[85%]",
              isUser 
                ? "rounded-2xl px-4 py-3 shadow-sm bg-primary text-primary-foreground rounded-tr-none" 
                : "rounded-2xl px-4 py-3 shadow-sm bg-assistant-light dark:bg-card/95 text-foreground rounded-tl-none border border-assistant-border dark:border-accent/50 dark:shadow-md"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                isUser ? "bg-primary-foreground" : "bg-white dark:bg-muted/90"
              )}>
                {isUser ? (
                  <Building className="w-4 h-4 text-primary" />
                ) : (
                  <Bot className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                {isUser ? (
                  <div className={cn("mb-1 flex flex-col justify-center min-h-[24px]", `text-${textSize}`)}>{message.content}</div>
                ) : (
                  <>
                    {message.content ? (
                      <div 
                        className={cn("mb-1 assistant-content", `text-${textSize}`)} 
                        dangerouslySetInnerHTML={{ __html: message.content }}
                      />
                    ) : null}
                  </>
                )}
                
                {(!message.content && !isUser && message.isTyping) && (
                  <div className="flex items-center gap-2 p-2">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <span className={cn("text-muted-foreground", `text-${textSize}`)}
>Pensando...</span>
                  </div>
                )}
                <div className={cn(
                  "text-xs mt-1 text-right",
                  isUser ? "text-primary-foreground/70" : "text-foreground/50"
                )}>
                  {formattedTime}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
