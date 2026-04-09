
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, Mail, ArrowRight } from 'lucide-react';

const VerifyEmailNotice = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Redirect to home if no user or already verified
  if (!user) {
    navigate('/auth');
    return null;
  }
  
  if (user.emailVerified) {
    navigate('/assistant');
    return null;
  }
  
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
          <CardTitle>Verifica tu email</CardTitle>
          <CardDescription>
            Hemos enviado un correo de verificación a {user.email}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="p-6 flex justify-center">
            <Mail className="h-24 w-24 text-primary" />
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Por favor, revisa tu bandeja de entrada y haz clic en el enlace de verificación
              para activar tu cuenta.
            </p>
            <p className="text-muted-foreground text-sm">
              No olvides revisar tu carpeta de spam si no encuentras el correo.
            </p>
          </div>
          
          <div className="pt-4 flex flex-col gap-3">
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground"
              onClick={() => {
                logout();
                navigate('/auth');
              }}
            >
              Cerrar sesión y volver al inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmailNotice;
