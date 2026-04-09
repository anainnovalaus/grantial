
import React from 'react';
import { useChat } from '@/context/ChatContext';
import { Card } from '@/components/ui/card';
import { Calendar, CheckCircle2, ClipboardList, ArrowUpRightSquare, Search, Info, FileText, Bot } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  message: string;
  needsGrantSelected?: boolean;
}

const PromptSuggestions: React.FC = () => {
  const { sendMessage } = useChat();

  const quickActions: QuickAction[] = [
    {
      id: "today-grants",
      title: "Subvenciones de hoy",
      description: "Muestra las subvenciones disponibles hoy",
      icon: <Calendar className="h-4 w-4 text-primary" />,
      message: "Lista las subvenciones que están disponibles hoy"
    },
    {
      id: "compatible",
      title: "Mis subvenciones compatibles",
      description: "Muestra las subvenciones que más se adaptan a mi perfil",
      icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
      message: "Lista las subvenciones que tengan compatibilidad con mi perfil"
    },
    {
      id: "requirements",
      title: "Requisitos",
      description: "Información sobre requisitos para aplicar",
      icon: <ClipboardList className="h-4 w-4 text-primary" />,
      message: "¿Cuáles son los requisitos para aplicar a subvenciones?",
      needsGrantSelected: true
    },
    {
      id: "application",
      title: "Proceso de solicitud",
      description: "Cómo aplicar a una subvención",
      icon: <ArrowUpRightSquare className="h-4 w-4 text-primary" />,
      message: "Explícame el proceso para solicitar una subvención"
    },
    {
      id: "search-grant",
      title: "Buscar subvención",
      description: "Buscar una subvención específica",
      icon: <Search className="h-4 w-4 text-primary" />,
      message: "Busca una subvención por nombre o categoría",
      needsGrantSelected: true
    },
    {
      id: "grant-list",
      title: "Listar subvenciones",
      description: "Por fecha o finalidad concreta",
      icon: <FileText className="h-4 w-4 text-primary" />,
      message: "Lista subvenciones por fecha o finalidad"
    }
  ];

  const handleQuickAction = async (action: QuickAction) => {
    await sendMessage(action.message);
  };

  return (
    <Card className="w-full p-4 rounded-lg shadow-md border-primary/20 bg-card/50 backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Preguntas sugeridas</h3>
      </div>
      
      <div className="space-y-2">
        {quickActions.map((action) => (
          action.needsGrantSelected ? (
            <TooltipProvider key={action.id}>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleQuickAction(action)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-primary/5 dark:hover:bg-primary/10 border border-primary/10 dark:border-primary/20 bg-background/50 dark:bg-card/50"
                  >
                    <div className="p-1.5 bg-primary/10 rounded-full">
                      {action.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-foreground">{action.title}</h4>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-primary text-primary-foreground border-none">
                  <p>Recuerda seleccionar una subvención</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              className="w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-primary/5 dark:hover:bg-primary/10 border border-primary/10 dark:border-primary/20 bg-background/50 dark:bg-card/50"
            >
              <div className="p-1.5 bg-primary/10 rounded-full">
                {action.icon}
              </div>
              <div>
                <h4 className="font-medium text-sm text-foreground">{action.title}</h4>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </button>
          )
        ))}
      </div>
    </Card>
  );
};

export default PromptSuggestions;
