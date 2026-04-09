
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot } from 'lucide-react';
import SignInForm from '@/components/auth/SignInForm';
import SignUpForm from '@/components/auth/SignUpForm';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('signin');
  
  // Get the redirect path from location state or default to home
  const from = location.state?.from?.pathname || '/';
  
  useEffect(() => {
    // If already authenticated, redirect to the original destination or home
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
    
    // Check for tab parameter in URL
    const tab = searchParams.get('tab');
    if (tab && ['signin', 'signup', 'forgot-password'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [isAuthenticated, navigate, from, searchParams]);
  
  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(`/auth?tab=${value}`, { replace: true });
  };
  
  return (
    <div className="flex min-h-screen flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="mb-8 flex flex-col items-center">
        <Bot className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Bienvenido a Grantial
        </h2>
        <p className="mt-2 text-center text-muted-foreground max-w-md">
          Tu asistente inteligente para encontrar y gestionar subvenciones de forma eficiente
        </p>
      </div>
      
      <div className="w-full max-w-md">
        <Card className="border-border">
          <CardHeader>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className={`grid w-full ${activeTab === 'forgot-password' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {activeTab !== 'forgot-password' && (
                  <>
                    <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
                    <TabsTrigger value="signup">Crear Cuenta</TabsTrigger>
                  </>
                )}
                {activeTab === 'forgot-password' && (
                  <TabsTrigger value="forgot-password">Recuperar Contraseña</TabsTrigger>
                )}
              </TabsList>
              
              <CardContent>
                <TabsContent value="signin" className="mt-0">
                  <SignInForm />
                  <div className="text-center mt-4">
                    <button 
                      onClick={() => handleTabChange('forgot-password')}
                      className="text-sm text-primary hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </TabsContent>
                
                <TabsContent value="signup" className="mt-0">
                  <SignUpForm />
                </TabsContent>
                
                <TabsContent value="forgot-password" className="mt-0">
                  <ForgotPasswordForm 
                    onCancel={() => handleTabChange('signin')}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </CardHeader>
          
          <CardFooter className="flex justify-center border-t pt-6">
            <p className="text-sm text-muted-foreground">
              Al continuar, aceptas nuestros&nbsp;
              <a href="/terms" className="text-primary hover:underline">Términos de Servicio</a>
              &nbsp;y&nbsp;
              <a href="/privacy" className="text-primary hover:underline">Política de Privacidad</a>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
