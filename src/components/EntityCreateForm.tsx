import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, CheckCircle, Sparkles, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  clearEntityProcessingTrackerState,
  setEntityProcessingTrackerState,
} from '@/utils/entityProcessingTracker';

// Configuración para llamar la API
const apiUrl= import.meta.env.VITE_API_URL;

interface FileWithPreview extends File {
  id: string;
  name: string;
}

interface EntityCreateFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (entityId: string) => void;
}

interface FirstHighMatch {
  grant_id: string | null;
  score: number | null;
}

interface ProcessingStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  stage: string;
  message: string;
  progress: number;
  processed_items: number;
  total_items: number;
  matches_found: number;
  best_match_score: number | null;
  first_high_match: FirstHighMatch | null;
  error: string | null;
}

const EntityCreateForm: React.FC<EntityCreateFormProps> = ({
  isOpen,
  onOpenChange,
  onSuccess
}) => {
  const navigate = useNavigate();
  const [entityName, setEntityName] = useState('');
  const [entityNif, setEntityNif] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [entityIdInProgress, setEntityIdInProgress] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [hasNotifiedHighMatch, setHasNotifiedHighMatch] = useState(false);
  const completionHandledRef = useRef(false);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => {
        const f = file as FileWithPreview;
        f.id = crypto.randomUUID();
        return f;
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes || isNaN(bytes) || bytes === 0) {
      return '';
    }
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  useEffect(() => {
    if (!isProcessing || !entityIdInProgress || !isOpen) return;

    const pollStatus = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const response = await fetch(`${apiUrl}/api/entity_processing_status?entity_id=${entityIdInProgress}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) return;

        const payload = await response.json();
        if (!payload?.success || !payload?.status) return;

        const status: ProcessingStatus = payload.status;
        setProcessingStatus(status);
        setProgress(Math.max(0, Math.min(100, status.progress || 0)));

        if (status.first_high_match && !hasNotifiedHighMatch) {
          const score = status.first_high_match.score != null
            ? Math.round(status.first_high_match.score * 100)
            : 85;
          toast.success(`¡Primer match potente detectado (${score}%)!`, {
            description: 'Ya puedes verlo mientras seguimos investigando más de 8.000 subvenciones.',
          });
          setHasNotifiedHighMatch(true);
          if (entityIdInProgress) {
            setEntityProcessingTrackerState({
              entityId: entityIdInProgress,
              minimized: true,
              openedHighMatch: true,
            });
          }
          setIsProcessing(false);
          resetForm();
          onOpenChange(false);
          navigate('/subvenciones-compatibles');
          return;
        }

        if (status.status === 'completed' && !completionHandledRef.current) {
          completionHandledRef.current = true;
          setProgress(100);
          toast.success('Análisis completado', {
            description: 'Te enviaremos por correo el resumen completo de matches.',
          });
          setTimeout(() => {
            setIsProcessing(false);
            resetForm();
            onOpenChange(false);
          }, 1200);
        }

        if (status.status === 'error' && !completionHandledRef.current) {
          completionHandledRef.current = true;
          toast.error(status.message || 'No se pudo completar el procesamiento de la entidad');
          setIsProcessing(false);
          resetForm();
        }
      } catch (statusError) {
        console.error('Error consultando estado de procesamiento:', statusError);
      }
    };

    pollStatus();
    const intervalId = window.setInterval(pollStatus, 4000);
    return () => window.clearInterval(intervalId);
  }, [entityIdInProgress, hasNotifiedHighMatch, isOpen, isProcessing, navigate, onOpenChange]);

  const handleSubmit = async () => {
    if (!entityName.trim() || !entityNif.trim()) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    setIsProcessing(true);
    setProgress(8);
    clearEntityProcessingTrackerState();
    completionHandledRef.current = false;
    setHasNotifiedHighMatch(false);
    setProcessingStatus({
      status: 'running',
      stage: 'queued',
      message: 'Creando tu entidad e iniciando análisis...',
      progress: 8,
      processed_items: 0,
      total_items: 0,
      matches_found: 0,
      best_match_score: null,
      first_high_match: null,
      error: null,
    });
    
    try {
      const formData = new FormData();
      formData.append('razon_social', entityName);
      formData.append('nif', entityNif);
      formData.append('pagina_web', websiteUrl);
      files.forEach(file => formData.append('files', file));

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${apiUrl}/api/create_entity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        const newEntityId = String(data.entity_id);
        setEntityIdInProgress(newEntityId);
        if (onSuccess) {
          onSuccess(newEntityId);
        }
        toast.success('Entidad creada correctamente', {
          description: 'Comenzamos el scraping y el matching en segundo plano.',
        });
      } else {
        toast.error(data.message || 'Error al crear la entidad');
        setIsProcessing(false);
        setProgress(0);
        setProcessingStatus(null);
        clearEntityProcessingTrackerState();
      }
    } catch (error) {
      console.error('Error al crear entidad:', error);
      toast.error('Error al crear la entidad');
      setIsProcessing(false);
      setProgress(0);
      setProcessingStatus(null);
      clearEntityProcessingTrackerState();
    }
  };
  
  const resetForm = () => {
    setEntityName('');
    setEntityNif('');
    setWebsiteUrl('');
    setFiles([]);
    setProgress(0);
    setEntityIdInProgress(null);
    setProcessingStatus(null);
    setHasNotifiedHighMatch(false);
    completionHandledRef.current = false;
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isProcessing && !entityIdInProgress) {
        toast.info('Estamos iniciando el proceso, espera unos segundos.');
        return;
      }
      if (isProcessing && entityIdInProgress) {
        setEntityProcessingTrackerState({
          entityId: entityIdInProgress,
          minimized: true,
          openedHighMatch: hasNotifiedHighMatch,
        });
        toast.info('Seguimos procesando tu entidad en segundo plano.');
      }
      setIsProcessing(false);
      resetForm();
    }
    onOpenChange(open);
  };
  
  const firstHighMatchScore = processingStatus?.first_high_match?.score != null
    ? Math.round(processingStatus.first_high_match.score * 100)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isProcessing ? 'Procesando información' : 'Crear nueva entidad'}
          </DialogTitle>
          <DialogDescription>
            {isProcessing 
              ? 'Tu entidad se analiza en dos fases: scraping y matching progresivo.'
              : 'Introduce los datos básicos y documentos de tu entidad. Los documentos se almacenarán de forma segura y analizaremos la información automáticamente.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {isProcessing ? (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="relative">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Procesando tu información</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {processingStatus?.message || 'Estamos procesando scraping y matching de tu entidad.'}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <Progress value={progress} className="w-full h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{processingStatus?.stage === 'matching' ? 'Matching en curso' : 'Procesando...'}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
            
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {progress >= 100 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span>
                  {processingStatus?.stage === 'scraping'
                    ? 'Scraping de entidad en curso'
                    : processingStatus?.stage === 'matching'
                      ? 'Generando matches por fases'
                      : 'Inicializando proceso'}
                </span>
              </div>
              {processingStatus?.stage === 'matching' && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>
                    Revisadas {processingStatus?.processed_items || 0}
                    {processingStatus?.total_items ? ` / ${processingStatus.total_items}` : ''} subvenciones
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Te enviaremos un correo con todos los matches al finalizar.</span>
              </div>
            </div>

            {processingStatus?.first_high_match && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  Primer match encontrado con alta compatibilidad
                </div>
                <p className="text-sm text-muted-foreground">
                  {firstHighMatchScore != null
                    ? `Compatibilidad estimada: ${firstHighMatchScore}%.`
                    : 'Compatibilidad superior al 85%.'}
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    handleOpenChange(false);
                    navigate('/subvenciones-compatibles');
                  }}
                >
                  Ver mis subvenciones compatibles
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
            
            <p className="text-xs text-center text-muted-foreground">
              Estamos investigando más de 8.000 subvenciones. Puedes cerrar y seguir navegando mientras terminamos.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="entity-name" className="font-medium">Razón social <span className="text-destructive">*</span></Label>
              <Input
                id="entity-name"
                placeholder="Nombre de la empresa o entidad"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="entity-nif" className="font-medium">NIF<span className="text-destructive">*</span></Label>
              <Input
                id="entity-nif"
                placeholder="Ej: B12345678"
                value={entityNif}
                onChange={(e) => setEntityNif(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="entity-website" className="font-medium">Página web</Label>
              <Input
                id="entity-website"
                type="url"
                placeholder="https://www.ejemplo.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Al proporcionar la URL, analizaremos su contenido para obtener información relevante.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="font-medium">Documentos</Label>
              <div className="border-2 border-dashed rounded-md p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Arrastra aquí tus archivos o haz clic para seleccionarlos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Puedes adjuntar: Pitch Deck, NEOTEC, presentaciones, etc.
                  </p>
                </div>
              </div>
              
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Archivos seleccionados ({files.length}):
                  </p>
                  {files.map((file) => {
                    return (
                      <div key={file.id} className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeFile(file.id)}
                          title="Eliminar archivo"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        
        {!isProcessing && (
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
            >
              Crear entidad
            </Button>
          </DialogFooter>
        )}
        {isProcessing && (
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!entityIdInProgress}
              onClick={() => handleOpenChange(false)}
            >
              {entityIdInProgress ? 'Seguir en segundo plano' : 'Inicializando...'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
export default EntityCreateForm;
