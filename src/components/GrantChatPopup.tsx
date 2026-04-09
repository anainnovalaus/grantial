
import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, ClipboardList, ArrowUpRightSquare, Info } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';

interface GrantInfo {
  title: string;
  amount: string;
  deadline: string;
  description: string;
  beneficiario?: string;
  lugar?: string;
}

interface GrantChatPopupProps {
  grantInfo: GrantInfo;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  message: string;
  icon: React.ReactNode;
}

const GrantChatPopup: React.FC<GrantChatPopupProps> = ({ grantInfo, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Definir acciones rápidas específicas para esta subvención
  const quickActions: QuickAction[] = [
    {
      id: "requirements",
      title: "Requisitos",
      icon: <ClipboardList className="h-4 w-4 text-primary" />,
      message: `¿Cuáles son los requisitos para aplicar a la subvención "${grantInfo.title}"?`
    },
    {
      id: "deadline",
      title: "Fecha límite",
      icon: <Calendar className="h-4 w-4 text-primary" />,
      message: `¿Cuándo es la fecha límite para la subvención "${grantInfo.title}"?`
    },
    {
      id: "process",
      title: "Proceso",
      icon: <ArrowUpRightSquare className="h-4 w-4 text-primary" />,
      message: `¿Cómo es el proceso para solicitar la subvención "${grantInfo.title}"?`
    },
    {
      id: "eligibility",
      title: "Elegibilidad",
      icon: <Info className="h-4 w-4 text-primary" />,
      message: `¿Quién puede aplicar a la subvención "${grantInfo.title}"?`
    }
  ];

  useEffect(() => {
    // Añadir mensaje inicial del asistente con la información de la subvención
    const initialMessage: Message = {
      id: 'initial',
      role: 'assistant',
      content: `Estoy aquí para ayudarte con la subvención **"${grantInfo.title}"**. 
    
Algunos detalles importantes:
- **Cantidad:** ${grantInfo.amount}
- **Fecha límite:** ${grantInfo.deadline}
${grantInfo.beneficiario ? `- **Beneficiarios:** ${grantInfo.beneficiario}` : ''}
${grantInfo.lugar ? `- **Lugar de aplicación:** ${grantInfo.lugar}` : ''}

¿En qué puedo ayudarte con esta subvención?`,
      timestamp: new Date()
    };

    setMessages([initialMessage]);
  }, [grantInfo]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    try {
      // Simulamos una respuesta del asistente
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: getSimulatedResponse(content, grantInfo),
          timestamp: new Date()
        };
        
        setMessages(prevMessages => [...prevMessages, assistantMessage]);
        setIsLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setIsLoading(false);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSendMessage(action.message);
  };

  // Función para simular respuestas del asistente basadas en palabras clave
  const getSimulatedResponse = (userMessage: string, grantInfo: GrantInfo): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('requisito') || lowerMessage.includes('requerim')) {
      return `Para solicitar la subvención "${grantInfo.title}" los principales requisitos son:\n\n1. Cumplir con el perfil de beneficiario: ${grantInfo.beneficiario || 'Consultar bases de la convocatoria'}\n2. Presentar la solicitud antes del ${grantInfo.deadline}\n3. Completar la documentación requerida (formularios, plan de negocio, etc.)\n\n¿Necesitas más detalles sobre algún requisito específico?`;
    }
    
    if (lowerMessage.includes('plazo') || lowerMessage.includes('fecha') || lowerMessage.includes('deadline')) {
      return `El plazo para solicitar esta subvención finaliza el ${grantInfo.deadline}. Es importante presentar toda la documentación requerida antes de esa fecha límite.`;
    }
    
    if (lowerMessage.includes('document') || lowerMessage.includes('papel')) {
      return 'La documentación habitual incluye:\n\n- Formulario de solicitud\n- CIF/NIF de la entidad\n- Escrituras o acta de constitución\n- Memoria técnica del proyecto\n- Presupuesto detallado\n- Certificados de estar al corriente con Hacienda y Seguridad Social\n\nDesde Innovalaus podemos ayudarte a preparar toda esta documentación.';
    }
    
    if (lowerMessage.includes('tramitar') || lowerMessage.includes('solicitar')) {
      return 'Para tramitar esta subvención, puedes pulsar el botón "Enviar a tramitar" y nuestro equipo se pondrá en contacto contigo para guiarte durante todo el proceso. Nos encargaremos de revisar tu caso específico, preparar la documentación necesaria y presentar la solicitud en tiempo y forma.';
    }
    
    if (lowerMessage.includes('probabilidad') || lowerMessage.includes('posibilidad') || lowerMessage.includes('chance')) {
      return 'La probabilidad de éxito depende de varios factores como el encaje de tu entidad con los requisitos, la calidad de la documentación presentada y la competencia en la convocatoria. Desde Innovalaus analizamos estos factores para maximizar tus posibilidades y solo recomendamos tramitar aquellas subvenciones donde vemos opciones reales de éxito.';
    }
    
    return `Gracias por tu pregunta sobre la subvención "${grantInfo.title}". ${grantInfo.description}\n\n¿Hay algo específico que quieras saber sobre esta subvención?`;
  };

  return (
    <Card className="w-[500px] h-[450px] flex flex-col overflow-hidden shadow-lg border-primary/20">
      <div className="flex items-center justify-between border-b p-3 bg-card">
        <h3 className="font-medium text-sm">Asistente de subvenciones</h3>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message}
              isLatest={message.id === messages[messages.length - 1]?.id}
              textSize="base"
            />
          ))}
          {isLoading && (
            <div className="flex justify-center py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Panel lateral de sugerencias */}
        <div className="w-[150px] border-l border-primary/10 p-2 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground mb-2">Preguntas sugeridas</p>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="w-full flex items-center gap-1.5 p-2 rounded-md text-left text-xs transition-colors hover:bg-primary/5 border border-primary/10 bg-background/50"
              >
                <div className="p-1 bg-primary/10 rounded-full">
                  {action.icon}
                </div>
                <span className="font-medium">{action.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-3 border-t">
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </Card>
  );
};

export default GrantChatPopup;
