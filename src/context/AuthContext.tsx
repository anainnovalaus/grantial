import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, password: string) => Promise<boolean>;
  verifyEmail: (token: string) => Promise<boolean>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const buildApiUrl = (path: string) => (API_URL ? `${API_URL}${path}` : path);

const AUTH_ERROR_PATTERNS = [
  'invalid token',
  'token has expired',
  'token has been revoked',
  'missing or invalid refresh token',
  'invalid token format',
  'token not found or already revoked',
  'authentication required',
];

const shouldInvalidateSession = (status: number, errorMessage: string): boolean => {
  if (status !== 401 && status !== 403) {
    return false;
  }
  const normalized = (errorMessage || '').toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const refreshRateLimitedUntilRef = useRef(0);
  const { toast } = useToast();

  const clearStoredSession = useCallback(() => {
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
  }, []);

  useEffect(() => {
    const handleSessionInvalidated = () => {
      clearStoredSession();
    };

    window.addEventListener('auth:session-invalidated', handleSessionInvalidated);
    return () => {
      window.removeEventListener('auth:session-invalidated', handleSessionInvalidated);
    };
  }, [clearStoredSession]);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const storedRefreshToken = localStorage.getItem('refreshToken');

        if (!accessToken && !storedRefreshToken) {
          setIsLoading(false);
          return;
        }
        
        // Rehydrate user session from local storage and let the fetch interceptor refresh lazily.
        const userData = localStorage.getItem('userData');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        clearStoredSession();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }, 10 * 60 * 1000); // Refresh every 10 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  const refreshToken = async (): Promise<boolean> => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      return false;
    }

    if (refreshRateLimitedUntilRef.current > Date.now()) {
      return false;
    }

    try {
      const response = await fetch(buildApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storedRefreshToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = Number(retryAfterHeader);
          const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? Math.min(retryAfterSeconds * 1000, 180000)
            : 60000;
          refreshRateLimitedUntilRef.current = Date.now() + waitMs;
          console.warn('Skipping token refresh due to 429 rate limit', { waitMs });
          return false;
        }

        let errorMessage = 'Token refresh failed';
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload?.error === 'string') {
            errorMessage = errorPayload.error;
          }
        } catch {
          // Ignore parse errors and keep fallback message
        }

        const normalizedError = errorMessage.toLowerCase();
        const latestRefreshToken = localStorage.getItem('refreshToken');
        const tokenRotatedInAnotherTab =
          normalizedError.includes('token not found or already revoked') &&
          !!latestRefreshToken &&
          latestRefreshToken !== storedRefreshToken;

        if (tokenRotatedInAnotherTab) {
          console.warn('Refresh token already rotated in another tab; session is kept.');
        } else if (shouldInvalidateSession(response.status, errorMessage)) {
          clearStoredSession();
        } else {
          console.warn('Skipping session invalidation after refresh error', {
            status: response.status,
            errorMessage,
          });
        }
        return false;
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);
      refreshRateLimitedUntilRef.current = 0;
      
      return true;
    } catch (error) {
      console.error('Token refresh network error:', error);
      // Do not force logout on transient network errors.
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('=== TRY TO LOGIN ===');
      setIsLoading(true);
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (data.next_url) {
        window.location.assign(data.next_url);
      }

      if (!response.ok) {
        console.error('Login failed:', data);
        toast({
          title: "Error de inicio de sesión",
          description: data.error || "Credenciales inválidas",
          variant: "destructive",
        });
        return false;
      }

      // Store tokens
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);

      // Create user data
      const userData: User = {
        id: data.user_id,
        email: email,
        emailVerified: data.email_verified,
        onboardingCompleted: data.onboarding_completed !== false,
      };

      // Store user data
      localStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);

      toast({
        title: "Sesión iniciada",
        description: "Has iniciado sesión correctamente",
      });

      return true;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al iniciar sesión",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        await fetch(buildApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${refreshToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear user data and tokens regardless of API call result
      clearStoredSession();
      setIsLoading(false);
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión correctamente",
      });
    }
  };

  const register = async (email: string, password: string, name?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error de registro",
          description: data.error || "No se pudo completar el registro",
          variant: "destructive",
        });
        return false;
      }

      // Store tokens
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);

      // Create user data
      const userData: User = {
        id: data.user_id,
        email: email,
        name: name || data.name || data.user_name || email.split('@')[0], // Use provided name or fallback
        emailVerified: false, // New users need to verify email
        onboardingCompleted: false, // New users need to complete onboarding
      };

      // Store user data
      localStorage.setItem('userData', JSON.stringify(userData));
      setUser(userData);

      toast({
        title: "Registro exitoso",
        description: "Se ha enviado un correo de verificación a tu dirección de email",
      });

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error durante el registro",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (email: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(buildApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "No se pudo procesar la solicitud",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Solicitud enviada",
        description: "Si tu email está registrado, recibirás un enlace para restablecer tu contraseña",
      });

      return true;
    } catch (error) {
      console.error('Password reset request error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al procesar la solicitud",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (token: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(buildApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "No se pudo restablecer la contraseña",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Contraseña restablecida",
        description: "Tu contraseña ha sido restablecida correctamente. Ya puedes iniciar sesión.",
      });

      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al restablecer la contraseña",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(buildApiUrl(`/api/auth/verify-email?token=${token}`), {
        method: 'GET',
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          title: "Error de verificación",
          description: data.error || "No se pudo verificar el email",
          variant: "destructive",
        });
        return false;
      }
      
      const data = await response.json();

      // Update user's verification status if logged in
      if (user) {
        const updatedUser = { ...user, emailVerified: true };
        setUser(updatedUser);
        localStorage.setItem('userData', JSON.stringify(updatedUser));
      } else if (data.user_data) {
        // If user is not logged in but we got user data from verification, log them in
        const userData: User = {
          id: data.user_data.id,
          email: data.user_data.email,
          name: data.user_data.name || data.user_data.email.split('@')[0],
          emailVerified: true,
          onboardingCompleted: data.user_data.onboarding_completed || false,
        };
        
        // Store tokens if provided
        if (data.access_token && data.refresh_token) {
          localStorage.setItem('accessToken', data.access_token);
          localStorage.setItem('refreshToken', data.refresh_token);
        }
        
        setUser(userData);
        localStorage.setItem('userData', JSON.stringify(userData));
      }

      toast({
        title: "Email verificado",
        description: "Tu dirección de email ha sido verificada correctamente",
      });

      return true;
    } catch (error) {
      console.error('Email verification error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error durante la verificación",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };


  const completeOnboarding = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const accessToken = localStorage.getItem('accessToken');
      
      const response = await fetch(buildApiUrl('/api/auth/complete-onboarding'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      // Update user's onboarding status if logged in
      if (user) {
        const updatedUser = { ...user, onboardingCompleted: true };
        setUser(updatedUser);
        localStorage.setItem('userData', JSON.stringify(updatedUser));
      }

      toast({
        title: "¡Bienvenido a Grantial!",
        description: "Tu cuenta ha sido configurada correctamente",
      });
    } catch (error) {
      console.error('Complete onboarding error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al completar la configuración",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        requestPasswordReset,
        resetPassword,
        verifyEmail,
        completeOnboarding
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
