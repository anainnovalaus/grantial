
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const VerifyEmail = () => {
  const { verifyEmail, isLoading, login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu dirección de email...');
  
  const token = searchParams.get('token');
  
    useEffect(() => {
      const verifyToken = async () => {
        if (!token) {
          setStatus('error');
          setMessage('Token de verificación inválido o expirado.');
          return;
        }

        try {
          const success = await verifyEmail(token);
          if (success) {
            setStatus('success');
            setMessage('¡Tu email ha sido verificado correctamente!');
          } else {
            setStatus('error');
            setMessage(
              'No se pudo verificar tu email. El enlace puede ser inválido o ha expirado.'
            );
          }
        } catch (error) {
          setStatus('error');
          setMessage(
            'Ocurrió un error durante la verificación. Por favor, inténtalo de nuevo.'
          );
        }
    };

    verifyToken();
  // ← Sólo dependemos de `token`, así evitamos el bucle infinito
  }, [token]);
  
  const StatusIcon = () => {
    if (status === 'loading') return <Loader2 className="h-16 w-16 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-16 w-16 text-primary" />;
    return <AlertCircle className="h-16 w-16 text-destructive" />;
  };
  
  return (
    <div className="flex min-h-screen flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="mb-8 flex flex-col items-center">
        <Bot className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Grantial
        </h2>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verificación de Email</CardTitle>
          <CardDescription>
            {status === 'loading' ? 'Procesando tu solicitud...' : 'Resultado de la verificación'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="p-6 flex justify-center">
            <StatusIcon />
          </div>
          
          <div className="text-center">
            <p className={status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
              {message}
            </p>
          </div>
          
          <div className="pt-4">
            <Button 
              className="w-full" 
              onClick={() => navigate(status === 'success' ? '/onboarding' : '/auth')}
              disabled={isLoading || status === 'loading'}
            >
              {status === 'success' ? 'Comenzar configuración' : 'Ir a Iniciar Sesión'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
