import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  timestamp: Date;
  isTyping?: boolean; // Flag to indicate if the message is currently being "typed"
}

export interface GrantChatTarget {
  id: string | number;
  title?: string;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string, userId?: string, selectedGrant?: string | GrantChatTarget) => Promise<void>;
  clearMessages: () => void;
  remainingMessages: number;
  resetTime: string;
  refreshLimits: (userId?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface APIResponse {
  response: string;
  remaining?: number;
  reset_time?: string;
}

interface APIErrorResponse {
  error: string;
  message: string;
  remaining: number;
  reset_time: string;
}

// Typing speed configuration (characters per second)
const TYPING_SPEED = 20; // Characters per second

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(8);
  const [resetTime, setResetTime] = useState('00:00');

  // Function to fetch current limits from backend
  const refreshLimits = useCallback(async (userId?: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_chat_limits?user_id=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.remaining !== undefined) {
          setRemainingMessages(data.remaining);
        }
        if (data.reset_time) {
          setResetTime(data.reset_time);
        }
      }
    } catch (error) {
      console.error('Error fetching limits:', error);
    }
  }, []);

  const sendMessage = useCallback(async (content: string, userId?: string, selectedGrant?: string | GrantChatTarget) => {
    if (!content.trim()) return;
    const grantTarget =
      selectedGrant && typeof selectedGrant === 'object' && 'id' in selectedGrant
        ? selectedGrant
        : null;
    const isGrantScopedChat = Boolean(grantTarget?.id);

    // Check if this is a system info message (starts with [SYSTEM INFO])
    const isSystemInfo = content.startsWith('[SYSTEM INFO]');
    
    if (!isSystemInfo) {
      // Create and add the user's message to the chat (only for non-system messages)
      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: 'user',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
    }
    
    setIsLoading(true);

    // Add an immediate loading message from the assistant (only for non-system messages)
    const loadingMessageId = `loading-${Date.now()}`;
    
    if (!isSystemInfo) {
      const loadingMessage: Message = {
        id: loadingMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        isTyping: true,
      };
      
      // Show the loading message immediately
      setMessages(prev => [...prev, loadingMessage]);
    }

    try {
      const endpoint = isGrantScopedChat
        ? `${import.meta.env.VITE_API_URL}/api/grants/${grantTarget!.id}/chat`
        : `${import.meta.env.VITE_API_URL}/api/app_assistente`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isGrantScopedChat) {
        const token = localStorage.getItem('accessToken');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      } else {
        // Legacy path keeps this for backward compatibility
        headers['Access-Control-Allow-Origin'] = '*';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: content,
          user_id: userId,
          selectedGrant: typeof selectedGrant === 'string' ? selectedGrant : (grantTarget?.title || null),
          grantTitle: grantTarget?.title || null,
          messageHistory: messages.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });
      
      if (!response.ok) {
        // Manejar específicamente el error 429 (límite excedido)
        if (response.status === 429) {
          const errorData: APIErrorResponse = await response.json();
          
          setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
          
          const limitMessage: Message = {
            id: `limit-${Date.now()}`,
            content: `<strong>⚠️ Límite de preguntas alcanzado</strong><br><br>${errorData.message}<br><br>Tu límite se reseteará mañana a las ${errorData.reset_time}.`,
            role: 'assistant',
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, limitMessage]);
          setRemainingMessages(0);
          setResetTime(errorData.reset_time);
          
          toast.error('Has alcanzado el límite diario de preguntas');
          setIsLoading(false);
          return;
        }
        
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data: APIResponse = await response.json();
      
      // Actualizar contador de mensajes restantes
      if (data.remaining !== undefined) {
        setRemainingMessages(data.remaining);
        
        // Mostrar alerta cuando quedan pocas preguntas
        if (data.remaining === 2) {
          toast.warning(`⚠️ Solo te quedan ${data.remaining} preguntas hoy`);
        } else if (data.remaining === 1) {
          toast.warning(`⚠️ Esta es tu última pregunta del día`);
        }
      }
      
      if (data.reset_time) {
        setResetTime(data.reset_time);
      }

      // Format the response with simple HTML for text styling
      const formattedResponse = formatResponseWithHtml(data.response);
      
      if (isSystemInfo) {
        // For system info messages, we don't show any response
        setIsLoading(false);
        return;
      }
      
      // Remove the temporary loading message and create the real assistant message
      const assistantMessageId = (Date.now() + 1).toString();
      
      setMessages(prev => {
        // Filter out the loading message
        const filteredMessages = prev.filter(msg => msg.id !== loadingMessageId);
        
        // Add the new assistant message with typing state
        return [...filteredMessages, {
          id: assistantMessageId,
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          isTyping: true,
        }];
      });
      
      // El chat de subvención concreta prioriza respuesta inmediata (sin typing artificial).
      if (isGrantScopedChat) {
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: formattedResponse,
                isTyping: false,
              };
            }
            return msg;
          });
        });
        setIsLoading(false);
        return;
      }

      // Simulate typing effect
      let displayedContent = '';
      const fullContent = formattedResponse;
      
      // Calculate delay based on content length
      const totalTime = Math.min(fullContent.length / TYPING_SPEED * 1000, 10000); // Cap at 10 seconds
      const typingInterval = 50; // Update every 50ms
      const charsPerInterval = Math.max(1, Math.ceil((fullContent.length / (totalTime / typingInterval))));
      
      let charIndex = 0;
      
      const typingEffect = setInterval(() => {
        const nextIndex = Math.min(charIndex + charsPerInterval, fullContent.length);
        displayedContent = fullContent.substring(0, nextIndex);
        
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.id === assistantMessageId) {
              return { ...msg, content: displayedContent };
            }
            return msg;
          });
        });
        
        charIndex = nextIndex;
        
        if (charIndex >= fullContent.length) {
          clearInterval(typingEffect);
          // Set final message and remove typing flag
          setMessages(prev => {
            return prev.map(msg => {
              if (msg.id === assistantMessageId) {
                return { 
                  ...msg, 
                  content: fullContent,
                  isTyping: false 
                };
              }
              return msg;
            });
          });
        }
      }, typingInterval);
      
    } catch (error) {
      console.error('Error getting response:', error);
      // Remove the loading message
      if (!isSystemInfo) {
        setMessages(prev => prev.filter(msg => msg.id !== loadingMessageId));
        
        // Add a fallback message when there's a connection error
        const errorMessageId = `error-${Date.now()}`;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        setMessages(prev => [...prev, {
          id: errorMessageId,
          content: `<strong>Lo siento, no puedo conectar con el asistente.</strong><br>Error: ${errorMessage}<br><br>Asegúrate de que el servidor está en ejecución en ${import.meta.env.VITE_API_URL}`,
          role: 'assistant',
          timestamp: new Date(),
        }]);
        
        toast.error('No se pudo conectar con el asistente. Comprueba que el servidor esté activo.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  // Function to format text with basic HTML and improve spacing
  const formatResponseWithHtml = (text: string): string => {
    if (!text) return "";
    
    // First, fix excessive line breaks but maintain appropriate spacing
    let formatted = text.replace(/(\s*<br>\s*){3,}/g, '<br><br>');
    formatted = formatted.replace(/(\n\s*){3,}/g, '\n\n');
    
    // Ensure proper spacing in lists
    formatted = formatted.replace(/<\/li>\s*<li>/g, '</li><li>');
    
    // Convert basic markdown to HTML, if there's anything not already HTML
    if (!/<[a-z][\s\S]*>/i.test(formatted)) {
      formatted = formatted
        // Bold: **text** or __text__
        .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
        // Italic: *text* or _text_
        .replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>')
        // Lists: - item or * item with proper spacing
        .replace(/^[-*] (.*)/gm, '<li>$1</li>')
        // Titles: # Title
        .replace(/^# (.*)/gm, '<h1>$1</h1>')
        .replace(/^## (.*)/gm, '<h2>$1</h2>')
        .replace(/^### (.*)/gm, '<h3>$1</h3>')
        // Links: [text](url)
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Line breaks with proper spacing
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
    }
    
    // Ensure line breaks before and after list items for better readability
    if (formatted.includes('<li>')) {
      let inList = false;
      let result = '';
      const lines = formatted.split('<br>');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('<li>') && !inList) {
          // Start a new list with proper spacing
          result += '<ul>';
          inList = true;
          result += line;
        } else if (!line.includes('<li>') && inList && line.trim() !== '') {
          // End the list and add proper spacing
          result += '</ul>';
          inList = false;
          result += line;
        } else {
          result += line;
        }
        
        if (i < lines.length - 1) {
          result += '<br>';
        }
      }
      
      if (inList) {
        result += '</ul>';
      }
      
      formatted = result;
    }
    
    // Fix spacing issues with lists
    formatted = formatted.replace(/<\/ul><br><ul>/g, '</ul><ul>');
    formatted = formatted.replace(/<br><li>/g, '<li>');
    formatted = formatted.replace(/<\/li><br>/g, '</li>');
    
    // Improve paragraph spacing
    formatted = formatted.replace(/<\/p><br><p>/g, '</p><p>');
    formatted = formatted.replace(/<br><br>/g, '<br><br>');
    
    // Add consistent spacing after elements
    formatted = formatted.replace(/<\/h1>/g, '</h1><br>');
    formatted = formatted.replace(/<\/h2>/g, '</h2><br>');
    formatted = formatted.replace(/<\/h3>/g, '</h3><br>');
    formatted = formatted.replace(/<\/ul>/g, '</ul><br>');
    
    // Remove excessive spacing
    formatted = formatted.replace(/<br><br><br>/g, '<br><br>');
    
    // Add paragraph tags for better structure (only for text not already in elements)
    formatted = formatted.replace(/(<br>|^)(?!<\/?[a-z]+)(.*?)(?=((<br>)|$))/gi, (match, p1, p2) => {
      if (p2.trim() !== '') {
        return `${p1}<p>${p2}</p>`;
      }
      return match;
    });
    
    return formatted;
  };

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <ChatContext.Provider value={{
      messages,
      isLoading,
      sendMessage,
      clearMessages,
      remainingMessages,
      resetTime,
      refreshLimits
    }}>
      {children}
    </ChatContext.Provider>
  );
};
