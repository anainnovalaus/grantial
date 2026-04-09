import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { 
  Bold, Italic, List, ListOrdered, Heading2, Link as LinkIcon, 
  Image as ImageIcon, Undo, Redo, Save, X, Eye 
} from 'lucide-react';

interface BlogPost {
  id?: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  read_time: string;
  image_url: string;
  is_featured: boolean;
  status: 'draft' | 'published';
}

interface BlogPostEditorProps {
  post: BlogPost | null;
  onClose: () => void;
  onSaved: () => void;
}

const BlogPostEditor: React.FC<BlogPostEditorProps> = ({ post, onClose, onSaved }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<BlogPost>({
    title: post?.title || '',
    slug: post?.slug || '',
    excerpt: post?.excerpt || '',
    content: post?.content || '',
    author: post?.author || '',
    category: post?.category || 'Startups',
    read_time: post?.read_time || '5 min',
    image_url: post?.image_url || '',
    is_featured: post?.is_featured || false,
    status: post?.status || 'draft',
  });
  const [showPreview, setShowPreview] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image,
    ],
    content: formData.content,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, content: editor.getHTML() }));
    },
  });

  // Auto-generar slug desde el título
  useEffect(() => {
    if (!post?.id && formData.title) {
      const slug = formData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.title, post?.id]);

  const saveMutation = useMutation({
    mutationFn: async (data: BlogPost) => {
      const url = post?.id 
        ? `${apiUrl}/api/admin/blog/posts/${post.id}`
        : `${apiUrl}/api/admin/blog/posts`;
      
      const response = await fetch(url, {
        method: post?.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Error al guardar el artículo');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Artículo guardado',
        description: `El artículo ha sido ${post?.id ? 'actualizado' : 'creado'} correctamente`,
      });
      onSaved();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el artículo',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (status: 'draft' | 'published') => {
    if (!formData.title || !formData.content) {
      toast({
        title: 'Campos requeridos',
        description: 'El título y el contenido son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    saveMutation.mutate({
      ...formData,
      status,
      ...(post?.id && { id: post.id }),
    });
  };

  const addLink = () => {
    const url = window.prompt('URL del enlace:');
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('URL de la imagen:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  if (showPreview) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto max-w-4xl px-4 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Vista previa</h2>
              <Button onClick={() => setShowPreview(false)} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cerrar vista previa
              </Button>
            </div>
          </div>
        </div>
        <main className="flex-1 py-8 px-4">
          <div className="container mx-auto max-w-4xl">
            {formData.image_url && (
              <img 
                src={formData.image_url} 
                alt={formData.title}
                className="w-full h-64 md:h-96 object-cover rounded-lg mb-8"
              />
            )}
            <h1 className="text-4xl font-bold mb-4">{formData.title}</h1>
            <p className="text-xl text-muted-foreground mb-6">{formData.excerpt}</p>
            <div className="prose prose-lg max-w-none">
              <div dangerouslySetInnerHTML={{ __html: formData.content }} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {post?.id ? 'Editar artículo' : 'Nuevo artículo'}
            </h2>
            <div className="flex gap-2">
              <Button onClick={() => setShowPreview(true)} variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Vista previa
              </Button>
              <Button onClick={() => handleSubmit('draft')} variant="outline" size="sm" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Guardar borrador
              </Button>
              <Button onClick={() => handleSubmit('published')} size="sm" disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Publicar
              </Button>
              <Button onClick={onClose} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contenido principal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Título del artículo"
                    />
                  </div>

                  <div>
                    <Label htmlFor="slug">Slug (URL) *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="titulo-del-articulo"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      URL: /blog/{formData.slug || 'titulo-del-articulo'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="excerpt">Resumen *</Label>
                    <Textarea
                      id="excerpt"
                      value={formData.excerpt}
                      onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                      placeholder="Breve descripción del artículo (150-200 caracteres)"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Contenido *</Label>
                    <div className="border rounded-lg">
                      {/* Toolbar */}
                      <div className="border-b p-2 flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editor?.chain().focus().toggleBold().run()}
                          className={editor?.isActive('bold') ? 'bg-accent' : ''}
                        >
                          <Bold className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editor?.chain().focus().toggleItalic().run()}
                          className={editor?.isActive('italic') ? 'bg-accent' : ''}
                        >
                          <Italic className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                          className={editor?.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
                        >
                          <Heading2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editor?.chain().focus().toggleBulletList().run()}
                          className={editor?.isActive('bulletList') ? 'bg-accent' : ''}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                          className={editor?.isActive('orderedList') ? 'bg-accent' : ''}
                        >
                          <ListOrdered className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addLink}
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={addImage}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                        <div className="flex-1" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editor?.chain().focus().undo().run()}
                        >
                          <Undo className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editor?.chain().focus().redo().run()}
                        >
                          <Redo className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Editor */}
                      <EditorContent 
                        editor={editor} 
                        className="prose prose-sm max-w-none p-4 min-h-[400px] focus:outline-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="author">Autor</Label>
                    <Input
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      placeholder="Nombre del autor"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Categoría</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Startups">Startups</SelectItem>
                        <SelectItem value="Digitalización">Digitalización</SelectItem>
                        <SelectItem value="Europa">Europa</SelectItem>
                        <SelectItem value="Innovación">Innovación</SelectItem>
                        <SelectItem value="Sostenibilidad">Sostenibilidad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="read_time">Tiempo de lectura</Label>
                    <Input
                      id="read_time"
                      value={formData.read_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, read_time: e.target.value }))}
                      placeholder="5 min"
                    />
                  </div>

                  <div>
                    <Label htmlFor="image_url">Imagen destacada (URL)</Label>
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                      placeholder="https://..."
                    />
                    {formData.image_url && (
                      <img 
                        src={formData.image_url} 
                        alt="Preview" 
                        className="mt-2 w-full h-32 object-cover rounded"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_featured"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="is_featured" className="cursor-pointer">
                      ⭐ Marcar como destacado
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BlogPostEditor;
