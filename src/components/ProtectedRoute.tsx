
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireVerified?: boolean;
  requireOnboarding?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireVerified = false, 
  requireOnboarding = false 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // If authentication is still loading, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Cargando...</span>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If verification is required but user is not verified
  if (requireVerified && user && !user.emailVerified) {
    return <Navigate to="/verify-email-notice" replace />;
  }


  // If onboarding is required but user hasn't completed it
  if (requireOnboarding && user && user.emailVerified && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  // If authenticated (and verified and onboarded if required), render the protected content
  return <>{children}</>;
};
