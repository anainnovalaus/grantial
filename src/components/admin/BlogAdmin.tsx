import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Wand2, Pencil, Trash2, Eye } from 'lucide-react';
import BlogPostEditor from '@/components/admin/BlogPostEditor';
import AIArticleGenerator from '@/components/admin/AIArticleGenerator';
import { Link } from 'react-router-dom';

interface BlogPost {
  id: number;
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
  published_at?: string;
  created_at: string;
  updated_at: string;
}

const BlogAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');

  const apiUrl = import.meta.env.VITE_API_URL;

  // Obtener todos los posts (incluye borradores)
  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ['adminBlogPosts'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/admin/blog/posts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Error al obtener los artículos');
      return response.json();
    },
  });

  // Eliminar post
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${apiUrl}/api/admin/blog/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Error al eliminar el artículo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
      toast({
        title: 'Artículo eliminado',
        description: 'El artículo ha sido eliminado correctamente',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el artículo',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setShowEditor(true);
  };

  const handleNewPost = () => {
    setEditingPost(null);
    setShowEditor(true);
  };

  const handleDelete = (id: number, title: string) => {
    if (window.confirm(`¿Estás seguro de eliminar "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleAIGenerated = (generatedArticle: Partial<BlogPost>) => {
    setEditingPost(generatedArticle as BlogPost);
    setShowAIGenerator(false);
    setShowEditor(true);
  };

  const filteredPosts = posts.filter(post => {
    if (filterStatus === 'all') return true;
    return post.status === filterStatus;
  });

  if (showEditor) {
    return (
      <BlogPostEditor
        post={editingPost}
        onClose={() => {
          setShowEditor(false);
          setEditingPost(null);
        }}
        onSaved={() => {
          setShowEditor(false);
          setEditingPost(null);
          queryClient.invalidateQueries({ queryKey: ['adminBlogPosts'] });
        }}
      />
    );
  }

  if (showAIGenerator) {
    return (
      <AIArticleGenerator
        onClose={() => setShowAIGenerator(false)}
        onGenerated={handleAIGenerated}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Gestión del Blog</h1>
            <p className="text-muted-foreground">
              Crea, edita y gestiona los artículos de tu blog
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Button onClick={handleNewPost} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo artículo
            </Button>
            <Button onClick={() => setShowAIGenerator(true)} variant="secondary" size="lg">
              <Wand2 className="h-4 w-4 mr-2" />
              Generar con IA
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
              size="sm"
            >
              Todos ({posts.length})
            </Button>
            <Button
              variant={filterStatus === 'published' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('published')}
              size="sm"
            >
              Publicados ({posts.filter(p => p.status === 'published').length})
            </Button>
            <Button
              variant={filterStatus === 'draft' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('draft')}
              size="sm"
            >
              Borradores ({posts.filter(p => p.status === 'draft').length})
            </Button>
          </div>

          {/* Posts List */}
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Cargando artículos...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {filterStatus === 'all' 
                    ? 'No hay artículos aún. ¡Crea el primero!'
                    : `No hay artículos ${filterStatus === 'draft' ? 'en borrador' : 'publicados'}`
                  }
                </p>
                <Button onClick={handleNewPost}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear artículo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {filteredPosts.map((post) => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                            {post.status === 'published' ? 'Publicado' : 'Borrador'}
                          </Badge>
                          {post.is_featured && (
                            <Badge variant="outline">⭐ Destacado</Badge>
                          )}
                          <Badge variant="outline">{post.category}</Badge>
                        </div>
                        <CardTitle className="text-2xl mb-2">{post.title}</CardTitle>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Por {post.author}</span>
                          <span>•</span>
                          <span>{post.read_time}</span>
                          {post.published_at && (
                            <>
                              <span>•</span>
                              <span>{new Date(post.published_at).toLocaleDateString('es-ES')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="w-32 h-24 object-cover rounded-lg"
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(post)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Link to={`/blog/${post.slug}`} target="_blank">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(post.id, post.title)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BlogAdmin;
