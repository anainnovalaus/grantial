
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, User, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNewsletterSubscription } from '@/hooks/useNewsletterSubscription';

const BlogArticle = () => {
  const { slug } = useParams();
  const { email, setEmail, isSubscribing, handleSubmit } = useNewsletterSubscription({
    source: 'blog_article',
  });

  const apiUrl = import.meta.env.VITE_API_URL;

  // Obtener artículo por slug desde la API
  const { data: article, isLoading } = useQuery({
    queryKey: ['blogPost', slug],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/blog/posts/${slug}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Error al obtener el artículo');
      }
      return response.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 pt-20 pb-16 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <p className="text-muted-foreground">Cargando artículo...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 pt-20 pb-16 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-2xl font-bold mb-4">Artículo no encontrado</h1>
            <Link to="/blog">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al blog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Back button */}
          <div className="mb-6">
            <Link to="/blog">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver al blog
              </Button>
            </Link>
          </div>

          {/* Article header */}
          <div className="mb-8">
            <Badge className="mb-4">{article.category}</Badge>
            <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
            <p className="text-xl text-muted-foreground mb-6">{article.excerpt}</p>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(article.published_at || article.created_at).toLocaleDateString('es-ES')}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{article.author}</span>
              </div>
              <span>{article.read_time}</span>
            </div>
          </div>

          {/* Article image */}
          {article.image_url && (
            <div className="mb-8">
              <img 
                src={article.image_url} 
                alt={article.title}
                className="w-full h-64 md:h-96 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Article content */}
          <div className="prose prose-lg max-w-none mb-12">
            <div dangerouslySetInnerHTML={{ __html: article.content }} />
          </div>

          {/* CTA Section */}
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">¿Te ha gustado este artículo?</h3>
              <p className="text-muted-foreground mb-6">
                Suscríbete a nuestro newsletter para recibir más consejos sobre subvenciones y financiación
              </p>
              
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-4">
                <Input
                  type="email"
                  placeholder="Tu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                  disabled={isSubscribing}
                />
                <Button type="submit" disabled={isSubscribing}>
                  {isSubscribing ? 'Suscribiendo...' : 'Suscribirse'}
                </Button>
              </form>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <span className="text-sm text-muted-foreground">¿Ya tienes una cuenta?</span>
                <Link to="/auth">
                  <Button variant="outline">
                    Iniciar sesión en Grantial
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default BlogArticle;