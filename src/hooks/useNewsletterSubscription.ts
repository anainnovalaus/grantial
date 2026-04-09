import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const emailSchema = z.string().email({ message: "Email inválido" }).max(255);

interface UseNewsletterSubscriptionProps {
  source?: 'blog' | 'blog_article' | 'landing' | 'other';
  onSuccess?: () => void;
}

interface SubscriptionResponse {
  success: boolean;
  message: string;
  subscription_id?: number;
  error?: string;
}

export const useNewsletterSubscription = ({ 
  source = 'blog',
  onSuccess 
}: UseNewsletterSubscriptionProps = {}) => {
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();

  const apiUrl = import.meta.env.VITE_API_URL;
  const accessToken = localStorage.getItem('accessToken');

  const validateEmail = (emailToValidate: string): boolean => {
    try {
      emailSchema.parse(emailToValidate);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Error de validación",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const subscribe = async (emailToSubscribe?: string) => {
    const emailValue = emailToSubscribe || email;
    
    if (!emailValue.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu email",
        variant: "destructive",
      });
      return false;
    }

    if (!validateEmail(emailValue)) {
      return false;
    }

    setIsSubscribing(true);

    try {
      const response = await fetch(`${apiUrl}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: emailValue.trim().toLowerCase(),
          source,
        }),
      });

      const data: SubscriptionResponse = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "¡Bienvenido a la comunidad!",
          description: data.message || "Ya formas parte de miles de emprendedores que buscan financiación y reciben las mejores noticias sobre emprendimiento y finanzas.",
        });
        
        setEmail('');
        onSuccess?.();
        return true;
      } else {
        toast({
          title: "Error",
          description: data.error || data.message || "No se pudo completar la suscripción",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Error en suscripción al newsletter:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Inténtalo de nuevo más tarde.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await subscribe();
  };

  return {
    email,
    setEmail,
    isSubscribing,
    subscribe,
    handleSubmit,
  };
};
export default useNewsletterSubscription;