import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export const useOnboarding = () => {
  const { user } = useAuth();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (user) {
      // Check if user has completed onboarding
      const onboardingStatus = user.onboardingCompleted || false;
      setIsOnboardingComplete(onboardingStatus);
    }
    setIsLoading(false);
  }, [user]);

  const completeOnboarding = async (): Promise<void> => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const accessToken = localStorage.getItem('accessToken');

      const response = await fetch(`${apiUrl}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setIsOnboardingComplete(true);
        
        // Update user data in localStorage
        if (user) {
          const updatedUser = { ...user, onboardingCompleted: true };
          localStorage.setItem('userData', JSON.stringify(updatedUser));
        }
      } else {
        throw new Error('Failed to update onboarding status');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  return {
    isOnboardingComplete,
    isLoading,
    completeOnboarding,
  };
};