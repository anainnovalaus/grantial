import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wand2, X, Loader2, RefreshCw } from 'lucide-react';

interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  read_time: string;
}

interface AIArticleGeneratorProps {
  onClose: () => void;
  onGenerated: (article: GeneratedArticle) => void;
}

const AIArticleGenerator: React.FC<AIArticleGeneratorProps> = ({ onClose, onGenerated }) => {
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL ;
  const accessToken = localStorage.getItem('accessToken');

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: 'Campo requerido',
        description: 'Por favor, describe el tema del artículo',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(`${apiUrl}/api/admin/blog/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ topic }),
      });

      if (!response.ok) {
        throw new Error('Error al generar el artículo');
      }

      const data = await response.json();
      setGeneratedArticle(data);
      
      toast({
        title: 'Artículo generado',
        description: 'El artículo ha sido generado con éxito. Revísalo y ajústalo si es necesario.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo generar el artículo. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseArticle = () => {
    if (generatedArticle) {
      onGenerated({
        ...generatedArticle,
        // Añadir campos adicionales con valores por defecto
        author: 'Grantial',
      } as any);
    }
  };

  const handleRegenerate = () => {
    setGeneratedArticle(null);
    handleGenerate();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              <h2 className="text-xl font-bold">Generar artículo con IA</h2>
            </div>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          {!generatedArticle ? (
            <Card>
              <CardHeader>
                <CardTitle>Describe el tema del artículo</CardTitle>
                <p className="text-sm text-muted-foreground">
                  La IA generará un artículo completo basado en tu descripción. Sé lo más específico posible.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="topic">Tema del artículo</Label>
                  <Textarea
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ejemplo: Quiero un artículo sobre las nuevas subvenciones para restaurantes en 2024, enfocado en digitalización. Debe incluir requisitos, montos disponibles y consejos prácticos para aplicar."
                    rows={8}
                    className="mt-2"
                    disabled={isGenerating}
                  />
                </div>

                <div className="bg-primary/5 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">💡 Consejos para mejores resultados:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Especifica el público objetivo (empresas, startups, autónomos, etc.)</li>
                    <li>Menciona el tipo de información que debe incluir</li>
                    <li>Indica si debe tener un tono formal o cercano</li>
                    <li>Sugiere puntos clave que debe cubrir</li>
                  </ul>
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !topic.trim()}
                  size="lg"
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generando artículo...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generar artículo
                    </>
                  )}
                </Button>

                {isGenerating && (
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Esto puede tomar entre 10-30 segundos...</p>
                    <p className="mt-2">La IA está analizando tu solicitud y generando contenido optimizado para SEO 🚀</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Preview del artículo generado */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Artículo generado</CardTitle>
                    <div className="flex gap-2">
                      <Button onClick={handleRegenerate} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerar
                      </Button>
                      <Button onClick={handleUseArticle} size="sm">
                        Usar este artículo
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Revisa el contenido y haz los ajustes necesarios en el editor
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Metadata */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoría sugerida</Label>
                      <p className="font-medium">{generatedArticle.category}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tiempo de lectura</Label>
                      <p className="font-medium">{generatedArticle.read_time}</p>
                    </div>
                  </div>

                  {/* Título */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <h3 className="text-2xl font-bold mt-1">{generatedArticle.title}</h3>
                  </div>

                  {/* Excerpt */}
                  <div>
                    <Label className="text-xs text-muted-foreground">Resumen</Label>
                    <p className="text-muted-foreground mt-1">{generatedArticle.excerpt}</p>
                  </div>

                  {/* Contenido */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Contenido completo</Label>
                    <div className="prose prose-sm max-w-none border rounded-lg p-6 bg-muted/30">
                      <div dangerouslySetInnerHTML={{ __html: generatedArticle.content }} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={handleUseArticle} size="lg" className="flex-1">
                      Usar este artículo
                    </Button>
                    <Button onClick={handleRegenerate} variant="outline" size="lg">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerar
                    </Button>
                    <Button onClick={onClose} variant="ghost" size="lg">
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AIArticleGenerator;
