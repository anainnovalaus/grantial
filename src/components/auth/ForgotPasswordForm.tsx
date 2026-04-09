
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email('Introduce un email válido'),
});

type FormValues = z.infer<typeof formSchema>;

interface ForgotPasswordFormProps {
  onCancel: () => void;
}

const ForgotPasswordForm = ({ onCancel }: ForgotPasswordFormProps) => {
  const { requestPasswordReset, isLoading } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });
  
  const onSubmit = async (values: FormValues) => {
    const success = await requestPasswordReset(values.email);
    if (success) {
      setIsSubmitted(true);
    }
  };
  
  if (isSubmitted) {
    return (
      <div className="text-center space-y-4 py-4">
        <CheckCircle className="h-12 w-12 text-primary mx-auto" />
        <h3 className="text-lg font-medium">Solicitud enviada</h3>
        <p className="text-muted-foreground text-sm">
          Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.
        </p>
        <p className="text-muted-foreground text-sm">
          Revisa tu bandeja de entrada y sigue las instrucciones.
        </p>
        <Button 
          variant="outline" 
          className="mt-4" 
          onClick={onCancel}
        >
          Volver a Iniciar Sesión
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Recuperar contraseña</h3>
        <p className="text-muted-foreground text-sm">
          Introduce tu dirección de email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="tu@email.com"
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar enlace'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ForgotPasswordForm;
