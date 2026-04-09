import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, User } from 'lucide-react';
import { useNewsletterSubscription } from '@/hooks/useNewsletterSubscription';

const Blog = () => {
  const { email, setEmail, isSubscribing, handleSubmit } = useNewsletterSubscription({
    source: 'blog',
  });

  const blogPosts = [
    {
      id: 1,
      title: "Cómo conseguir financiación para tu startup en 2024",
      excerpt: "Guía completa sobre las mejores estrategias para obtener subvenciones y financiación para empresas emergentes.",
      date: "2024-01-15",
      author: "María García",
      category: "Startups",
      readTime: "5 min"
    },
    {
      id: 2,
      title: "Las subvenciones más importantes para la transformación digital",
      excerpt: "Descubre las ayudas públicas disponibles para digitalizar tu empresa y modernizar tus procesos.",
      date: "2024-01-10",
      author: "Carlos López",
      category: "Digitalización",
      readTime: "7 min"
    },
    {
      id: 3,
      title: "Errores comunes al solicitar subvenciones europeas",
      excerpt: "Evita estos errores frecuentes que pueden hacer que tu solicitud de subvención sea rechazada.",
      date: "2024-01-05",
      author: "Ana Martín",
      category: "Europa",
      readTime: "6 min"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Blog de Grantial</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Descubre las últimas noticias, consejos y tendencias sobre subvenciones y financiación empresarial
            </p>
          </div>

          {/* Featured Post */}
          <Link to="/blog/featured">
            <Card className="mb-8 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                <Badge className="mb-3">Destacado</Badge>
                <h2 className="text-2xl font-bold mb-3">
                  Nuevas subvenciones para la sostenibilidad empresarial
                </h2>
                <p className="text-muted-foreground mb-4">
                  El gobierno ha anunciado un nuevo paquete de ayudas destinadas a empresas que implementen 
                  medidas de sostenibilidad y economía circular. Te contamos todos los detalles.
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>20 Enero 2024</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>Equipo Grantial</span>
                  </div>
                  <span>8 min lectura</span>
                </div>
              </div>
            </Card>
          </Link>

          {/* Blog Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <Link key={post.id} to={`/blog/${post.id}`}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <Badge variant="outline" className="w-fit mb-2">
                      {post.category}
                    </Badge>
                    <h3 className="text-lg font-semibold line-clamp-2">
                      {post.title}
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{post.author}</span>
                      </div>
                      <span>{post.readTime}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(post.date).toLocaleDateString('es-ES')}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Newsletter Subscription */}
          <Card className="mt-12 text-center">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Suscríbete a nuestro newsletter</h3>
              <p className="text-muted-foreground mb-6">
                Recibe las últimas noticias sobre subvenciones directamente en tu email
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Blog;