

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, Clock, MessageCircle, Shuffle, Heart, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from "sonner";
import { Separator } from '@/components/ui/separator';
import FloatingChatButton from '@/components/FloatingChatButton';
import { formatAmount } from '@/lib/utils';
import { formatDeadline, getDeadlineIcon, getDeadlineStatus, getDeadlineStyles } from '@/lib/deadline';
import GrantCard from '@/components/GrantCard';
import FloatingGrantAssistant from '@/components/FloatingGrantAssistant';
import { ChatProvider } from '@/context/ChatContext';
import GrantDetailShell from '@/components/grants/GrantDetailShell';
import { trackRecoEvent } from '@/lib/recoEvents';

interface Grant {
  id: string;
  titulo_corto: string;
  presupuesto: string;
  fecha_limite: string;
  resumen_completo: string;
  justificacion?: string;
  numero_match?: number;
  beneficiarios?: string;
  region_impacto?: string;
  finalidad?: string;
  recomendacion?: string;
  documentacion?: unknown;
  codigobdns?: string | null;
}

interface GrantPreferenceResponse {
  preference: 'interesa' | 'no interesa' | null;
}

const fetchGrantDetail = async (id: string): Promise<Grant> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_grant_detail/${id}`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
  
  if (!response.ok) {
    const error = new Error(`Error al obtener los detalles de la subvención (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  
  const data = await response.json();
  console.log("Fetched grant detail:", data);
  return data.grant;
};

const fetchRecommendedGrants = async (): Promise<Grant[]> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_recommended_grants?limit=3`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
    console.log("API response status:", response.status);

    if (!response.ok) {
      console.log("Failed to fetch recommended grants, returning empty array");
      return [];
    }

    const data = await response.json();
    console.log("Received recommended grants data:", data);

    if (!data.grants || !Array.isArray(data.grants)) {
      console.error("Invalid grants data format:", data);
      return [];
    }

    console.log("Parsed grants:", data.grants);
    return data.grants;
  } catch (error) {
    console.error("Error fetching recommended grants:", error);
    return [];
  }
};

const fetchGrantPreference = async (id: string): Promise<GrantPreferenceResponse> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_grant_preference/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`
    }
  });

  if (!response.ok) {
    const error = new Error(`Error al obtener la preferencia de la subvención (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const GrantDetail = () => {
  const [showChat, setShowChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [isProcessingPreference, setIsProcessingPreference] = useState(false);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  const [likeAnimation, setLikeAnimation] = useState(false);
  const [dislikeAnimation, setDislikeAnimation] = useState(false);
  const [userPreference, setUserPreference] = useState<'interesa' | 'no interesa' | null>(null);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const {
    data: grant,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['grantDetail', userId, id],
    queryFn: () => fetchGrantDetail(id || ''),
    enabled: !!id && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  const {
    data: recommendedGrants = [],
    isLoading: isLoadingRecommendations,
    error: recommendedGrantsError
  } = useQuery({
    queryKey: ['recommendedGrants', userId, 3],
    queryFn: fetchRecommendedGrants,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: grantPreference, error: grantPreferenceError } = useQuery({
    queryKey: ['grantPreference', userId, id],
    queryFn: () => fetchGrantPreference(id || ''),
    enabled: !!id && !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  console.log("Recommended grants in component:", recommendedGrants);
  
  useEffect(() => {
    if (error) {
      toast.error('Error al cargar los detalles de la subvención');
      console.error('Error fetching grant details:', error);
    }
    if (recommendedGrantsError) {
      console.error('Error fetching recommended grants:', recommendedGrantsError);
    }
    if (grantPreferenceError) {
      console.error('Error fetching user preference:', grantPreferenceError);
    }
  }, [error, grantPreferenceError, recommendedGrantsError]);

  useEffect(() => {
    if (!grant?.id) return;
    void trackRecoEvent({
      eventType: 'detail_open',
      grantId: grant.id,
      surface: 'grant_detail',
      metadata: { source: 'GrantDetail' },
    });
  }, [grant?.id]);

  useEffect(() => {
    setUserPreference(grantPreference?.preference ?? null);
  }, [grantPreference?.preference]);
  
  const formattedDeadline = formatDeadline(grant?.fecha_limite);
  const deadlineStatus = getDeadlineStatus(grant?.fecha_limite);
  const deadlineStylePalette = getDeadlineStyles(deadlineStatus);
  const deadlineStyles = {
    ...deadlineStylePalette,
    icon: getDeadlineIcon(deadlineStatus, `mr-2 h-4 w-4 ${deadlineStylePalette.textColor}`),
  };
  
  const formattedAmount = formatAmount(grant?.presupuesto);

  const matchPercentage = Math.round((grant?.numero_match ?? 0) * 100);


  const storeUserPreference = async (grantId: string, action: 'interesa' | 'no interesa', userId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store_user_preference`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_id: grantId,
          action: action,
          user_id: userId
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Demasiadas solicitudes. Espera un minuto y vuelve a intentarlo.');
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `Error al guardar la preferencia (${response.status})`);
        }

        const bodyText = await response.text().catch(() => '');
        if (bodyText.toLowerCase().includes('error 1015') || bodyText.toLowerCase().includes('rate limited')) {
          throw new Error('Cloudflare está limitando temporalmente las solicitudes.');
        }
        throw new Error(`Error al guardar la preferencia (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error storing user preference:', error);
      throw error;
    }
  };

  const handleLike = async () => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para guardar preferencias');
      return;
    }

    if (!grant?.id) {
      toast.error('No se pudo identificar la subvención');
      return;
    }

    setLikeAnimation(true);
    setTimeout(() => setLikeAnimation(false), 600);

    setIsProcessingPreference(true);
    try {
      await storeUserPreference(grant.id, 'interesa', user.id);
      void trackRecoEvent({
        eventType: 'like',
        grantId: grant.id,
        surface: 'grant_detail',
        metadata: { source: 'GrantDetail' },
      });
      setUserPreference('interesa');  // Update local state
      toast.success('Preferencia guardada correctamente');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar preferencia';
      toast.error(errorMessage);
    } finally {
      setIsProcessingPreference(false);
    }
  };

  const handleDislike = async () => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para guardar preferencias');
      return;
    }

    if (!grant?.id) {
      toast.error('No se pudo identificar la subvención');
      return;
    }

    setDislikeAnimation(true);
    setTimeout(() => setDislikeAnimation(false), 600);

    setIsProcessingPreference(true);
    try {
      await storeUserPreference(grant.id, 'no interesa', user.id);
      void trackRecoEvent({
        eventType: 'dislike',
        grantId: grant.id,
        surface: 'grant_detail',
        metadata: { source: 'GrantDetail' },
      });
      setUserPreference('no interesa');  // Update local state
      toast.success('Preferencia guardada correctamente');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar preferencia';
      toast.error(errorMessage);
    } finally {
      setIsProcessingPreference(false);
    }
  };


  const handleTramitar = () => {
    setIsSending(true);
    setConfettiActive(true);
    
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'fixed inset-0 pointer-events-none z-50';
    document.body.appendChild(confettiContainer);
    
    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      const size = Math.random() * 10 + 5;
      const colors = ['bg-purple-500', 'bg-indigo-500', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      confetti.className = `absolute rounded-md ${color} opacity-70`;
      confetti.style.width = `${size}px`;
      confetti.style.height = `${size}px`;
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.top = '0';
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      
      confetti.style.animation = `
        fall ${Math.random() * 3 + 2}s ease-in forwards,
        sway ${Math.random() * 0.5 * (Math.random() * 3 + 2)}s ease-in-out infinite alternate
      `;
      
      confetti.style.animationFillMode = 'forwards';
      
      const keyframes = `
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(${Math.random() * 720}deg);
            opacity: 0;
          }
        }
        @keyframes sway {
          from {
            transform: translateX(0) rotate(0);
          }
          to {
            transform: translateX(${Math.random() * 100}px) rotate(${Math.random() * 360}deg);
          }
        }
      `;
      
      const style = document.createElement('style');
      style.innerHTML = keyframes;
      document.head.appendChild(style);
      
      confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
      toast.success("Solicitud enviada a Innovalaus para tramitar", {
        description: "Te contactaremos pronto para gestionar esta subvención",
        duration: 5000,
      });
      setIsSending(false);
    }, 1000);
    
    setTimeout(() => {
      document.body.removeChild(confettiContainer);
      setConfettiActive(false);
    }, 5000);
  };
  
  const toggleChat = () => {
    console.log("Toggling chat:", !showChat);
    setShowChat(prevState => !prevState);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8 flex-grow">
          <div className="w-full flex justify-center items-center h-full">
            <div className="animate-pulse space-y-4 w-full max-w-5xl">
              <div className="h-8 bg-muted rounded-md w-3/4"></div>
              <div className="h-6 bg-muted rounded-md w-1/4"></div>
              <div className="h-40 bg-muted rounded-md"></div>
              <div className="h-20 bg-muted rounded-md"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !grant) {
    return (
      <div className="flex flex-col min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8 flex-grow">
          <div className="w-full flex flex-col justify-center items-center h-full">
            <p className="text-red-500 mb-4">Error al cargar los detalles de la subvención</p>
            <Link to="/subvenciones">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a la búsqueda
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const validRecommendedGrants = recommendedGrants?.map(grant => ({
      id: grant.id,
      titulo_corto: grant.titulo_corto || "Sin título",
      presupuesto: grant.presupuesto || "N/A",
      fecha_limite: grant.fecha_limite || "No especificada",
      resumen_completo: grant.resumen_completo,
      beneficiarios: grant.beneficiarios || "No especificados",
      region_impacto: grant.region_impacto || "No especificada",
      numero_match: grant.numero_match,
      justificacion: grant.justificacion
  })) || [];

  console.log("Valid recommended grants:", validRecommendedGrants);

  return (
    <ChatProvider>
      <GrantDetailShell
        backHref="/subvenciones"
        backLabel="Volver a la búsqueda"
        discoverHref="/swipe"
        detail={{
          grantId: grant.id,
          title: grant.titulo_corto,
          amountRaw: grant.presupuesto,
          amountFormatted: formattedAmount,
          deadlineFormatted: formattedDeadline,
          deadlineStyles,
          summaryHtml: grant.resumen_completo,
          justificationHtml: grant.justificacion,
          documentacion: grant.documentacion,
          beneficiaries: grant.beneficiarios,
          region: grant.region_impacto,
          finalidad: grant.finalidad,
          recommendationHtml: grant.recomendacion,
          matchPercentage,
        }}
        preferenceActions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleLike}
              disabled={isProcessingPreference}
              variant={userPreference === 'interesa' ? 'default' : 'ghost'}
              className={`
                flex items-center justify-center gap-2
                transition-all duration-200
                ${isProcessingPreference ? 'opacity-50' : ''}
                ${userPreference === 'interesa'
                  ? 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700'
                  : 'hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-600 dark:hover:text-green-400 text-muted-foreground'
                }
                group
              `}
              size="sm"
            >
              {isProcessingPreference ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className={`
                  h-4 w-4
                  group-hover:scale-110
                  transition-transform duration-200
                  ${likeAnimation ? 'animate-scale-in' : ''}
                  ${userPreference === 'interesa' ? 'fill-current' : ''}
                `} />
              )}
              Me interesa
            </Button>
            <Button
              onClick={handleDislike}
              disabled={isProcessingPreference}
              variant={userPreference === 'no interesa' ? 'default' : 'ghost'}
              className={`
                flex items-center justify-center gap-2
                transition-all duration-200
                ${isProcessingPreference ? 'opacity-50' : ''}
                ${userPreference === 'no interesa'
                  ? 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700'
                  : 'hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 text-muted-foreground'
                }
                group
              `}
              size="sm"
            >
              {isProcessingPreference ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <X className={`
                  h-4 w-4
                  group-hover:scale-110
                  transition-transform duration-200
                  ${dislikeAnimation ? 'animate-scale-in' : ''}
                `} />
              )}
              No me interesa
            </Button>
          </div>
        }
        recommendedSection={
          <div className="mt-16 mb-10">
            <h2 className="text-xl font-bold mb-6">Subvenciones recomendadas</h2>
            {isLoadingRecommendations ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse bg-card border rounded-lg p-5 shadow-sm h-48">
                    <div className="h-5 bg-muted rounded w-3/4 mb-4"></div>
                    <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/3 mb-4"></div>
                    <div className="h-12 bg-muted rounded mb-3"></div>
                    <div className="h-6 bg-muted rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : validRecommendedGrants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {validRecommendedGrants.slice(0, 3).map((grant) => (
                  <GrantCard
                    key={grant.id}
                    title={grant.titulo_corto}
                    amount={grant.presupuesto}
                    deadline={grant.fecha_limite}
                    description={grant.resumen_completo}
                    justificacion={grant.justificacion}
                    beneficiario={grant.beneficiarios}
                    lugar={grant.region_impacto}
                    finalidad={grant.finalidad}
                    grant_id={grant.id}
                    matchPercentage={grant.numero_match}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border rounded-lg bg-card">
                <p className="text-muted-foreground">No hay recomendaciones disponibles</p>
              </div>
            )}
          </div>
        }
      />
    </ChatProvider>
  );
};

export default GrantDetail;
