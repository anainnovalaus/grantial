import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building, Sparkles, CheckCircle, Upload, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from 'lucide-react';
import { EntityCreationProgress } from './EntityCreationProgress';
import { toast } from 'sonner';

interface FileWithPreview extends File {
  id: string;
  name: string;
}

interface EntityCreationStepProps {
  onEntityCreated?: () => void;
  isLoading?: boolean;
}

export const EntityCreationStep: React.FC<EntityCreationStepProps> = ({ 
  onEntityCreated, 
  isLoading = false 
}) => {
  const [entityName, setEntityName] = useState('');
  const [entityNif, setEntityNif] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [entityDescription, setEntityDescription] = useState('');
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL;
  const accessToken = localStorage.getItem('accessToken');


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

  const handleSubmit = async () => {
    if (!entityName.trim() || !entityNif.trim()) {
      toast.error('Por favor completa los campos obligatorios');
      return;
    }

    setIsSubmitting(true);

    try {
      // Crear FormData para enviar datos y archivos
      const formData = new FormData();
      formData.append('razon_social', entityName);
      formData.append('nif', entityNif);
      formData.append('pagina_web', websiteUrl);
      formData.append('descripcion_usuario', entityDescription);
      files.forEach(file => formData.append('files', file));

      const response = await fetch(`${apiUrl}/api/create_entity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success('¡Entidad creada correctamente!', {
          description: files.length > 0 
            ? 'Los documentos se procesarán y la información aparecerá en tu perfil automáticamente.'
            : 'Granti analizará la información para completar tu perfil automáticamente.'
        });
        
        if (onEntityCreated) {
          onEntityCreated();
        }
      } else {
        toast.error(data.message || 'Error al crear la entidad');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error al crear entidad:', error);
      toast.error('Error al crear la entidad');
      setIsSubmitting(false);
    }
  };

  const isFormDisabled = isSubmitting || isLoading;
  if (isSubmitting) {
    return (
      <EntityCreationProgress 
        hasWebsite={!!websiteUrl} 
        hasFiles={files.length > 0}
        onComplete={onEntityCreated}
      />
    );
  }



  return (
    <div className="flex flex-col h-full space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-3"
      >
        <h2 className="text-2xl font-bold text-foreground">
          Ya casi estamos. Cuéntame sobre tu empresa.
        </h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Con estos datos empezaré a buscar tus subvenciones. Cuanta más información me des, mejores serán los resultados.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start flex-1 overflow-hidden min-h-0">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4 overflow-y-auto pr-2 pl-2"
        >
          <div className="space-y-2">
            <Label htmlFor="entity-name" className="text-sm font-medium">
              Razón social <span className="text-destructive">*</span>
            </Label>
            <Input
              id="entity-name"
              placeholder="Nombre de la empresa o entidad"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              disabled={isFormDisabled}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity-nif" className="text-sm font-medium">
              NIF/CIF <span className="text-destructive">*</span>
            </Label>
            <Input
              id="entity-nif"
              placeholder="Ej: B12345678"
              value={entityNif}
              onChange={(e) => setEntityNif(e.target.value)}
              disabled={isFormDisabled}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity-website" className="text-sm font-medium">
              Página web (opcional)
            </Label>
            <Input
              id="entity-website"
              type="url"
              placeholder="https://www.ejemplo.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              disabled={isFormDisabled}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity-description" className="text-sm font-medium">
              Descripción de tu entidad (opcional)
            </Label>
            <Textarea
              id="entity-description"
              placeholder="Describe brevemente tu empresa: a qué te dedicas, productos/servicios, proyectos destacados, etc."
              value={entityDescription}
              onChange={(e) => setEntityDescription(e.target.value)}
              disabled={isFormDisabled}
              className="min-h-[80px] text-sm resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Documentos (opcional)
            </Label>
            <div className="border-2 border-dashed rounded-md p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                multiple 
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={handleFileChange}
                disabled={isFormDisabled}
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Arrastra archivos o haz clic
                </p>
                <p className="text-sm text-muted-foreground">
                  Pitch Deck, NEOTEC, presentaciones, etc.
                </p>
              </div>
            </div>
            
            {files.length > 0 && (
              <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                <p className="text-sm font-medium text-muted-foreground">
                  Archivos ({files.length}):
                </p>
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between bg-muted/30 p-2 rounded border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeFile(file.id)}
                      disabled={isFormDisabled}
                      title="Eliminar archivo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>


        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="space-y-4 overflow-y-auto pl-2"
        >
          <div className="bg-gradient-to-br from-primary/5 to-accent/5 p-4 rounded-lg border border-border/30">
            <div className="space-y-4">
              <div className="text-center">
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-base mb-2">¿Por qué te pedimos esto?</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Para encontrar TUS subvenciones</p>
                    <p className="text-sm text-muted-foreground">
                      Con tu NIF y razón social ya podemos empezar a buscar oportunidades reales para ti
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Más datos = mejores resultados</p>
                    <p className="text-sm text-muted-foreground">
                      Tu web y documentos nos permiten afinar al máximo. Es la diferencia entre resultados genéricos y resultados hechos a tu medida
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">No te pierdas ni una</p>
                    <p className="text-sm text-muted-foreground">
                      Te avisamos de cada subvención que encaje contigo antes de que cierre el plazo
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Nota:</strong> No te preocupes si no tienes todo ahora. Siempre podrás completar tu perfil después, pero cuanto más nos des ahora, antes encontraremos tus subvenciones
            </p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isFormDisabled || !entityName.trim() || !entityNif.trim()}
            className="w-full h-11 text-sm"
            size="default"
          >
            {isFormDisabled ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Empezar a encontrar mis subvenciones
              </>
            )}
          </Button>
        </motion.div>
      </div>

      {isFormDisabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground">
            Creando tu entidad y configurando tu experiencia personalizada...
          </p>
        </motion.div>
      )}
    </div>
  );
};