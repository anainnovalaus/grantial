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
import MatchCard from '@/components/MatchCard';
import FloatingGrantAssistant from '@/components/FloatingGrantAssistant';
import { ChatProvider } from '@/context/ChatContext';
import GrantDetailShell from '@/components/grants/GrantDetailShell';


interface Match {
  grant_id: string;
  titulo_corto: string;
  presupuesto: string;
  fecha_limite: string;
  justificacion: string;
  resumen_completo: string;
  beneficiarios?: string;
  region_impacto?: string;
  finalidad?: string;
  numero_match?: number;
  recomendacion?: string;
  documentacion?: unknown;
  codigobdns?: string | null;
}

interface RecommendedGrant {
  id: string;
  titulo_corto: string;
  presupuesto: string;
  fecha_limite: string;
  resumen_completo: string;
  beneficiarios?: string;
  region_impacto?: string;
  finalidad?: string;
  numero_match?: number;
}

type RecommendedGrantApiItem = Partial<RecommendedGrant> & {
  grant_id?: string;
};

interface GrantPreferenceResponse {
  preference: 'interesa' | 'no interesa' | null;
}

const fetchMatchDetail = async (id: string): Promise<Match> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_match_detail/${id}`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
  
  if (!response.ok) {
    const error = new Error(`Error al obtener los detalles del match (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  
  const data = await response.json();
  console.log("Fetched match detail:", data);
  return data.match;
};

const fetchRecommendedGrants = async (): Promise<RecommendedGrant[]> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_recommended_grants?limit=3`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });

    if (!response.ok) {
      console.log("Failed to fetch recommended grants, returning empty array");
      return [];
    }

    const data = await response.json();
    console.log("Fetched recommended grants:", data);
    if (!data.grants || !Array.isArray(data.grants)) {
      return [];
    }
    console.log("Fetched recommended grants:", data.grants);
    return (data.grants as RecommendedGrantApiItem[]).map((grant) => ({
      id: grant.grant_id || grant.id,
      titulo_corto: grant.titulo_corto || "Sin título",
      presupuesto: grant.presupuesto || "N/A",
      fecha_limite: grant.fecha_limite || "No especificada",
      resumen_completo: grant.resumen_completo,
      beneficiarios: grant.beneficiarios || "No especificados",
      region_impacto: grant.region_impacto || "No especificada",
      recomendacion: grant.recomendacion
    }));
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

const MatchDetail = () => {
  const [showChat, setShowChat] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [isProcessingPreference, setIsProcessingPreference] = useState(false);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [likeAnimation, setLikeAnimation] = useState(false);
  const [dislikeAnimation, setDislikeAnimation] = useState(false);
  const [userPreference, setUserPreference] = useState<'interesa' | 'no interesa' | null>(null);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const {
    data: match,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['matchDetail', user?.id, id],
    queryFn: () => fetchMatchDetail(id || ''),
    enabled: !!id && !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  const {
    data: recommendedGrants = [],
    isLoading: isLoadingRecommendations,
    error: recommendedGrantsError
  } = useQuery({
    queryKey: ['recommendedGrants', user?.id, 3],
    queryFn: fetchRecommendedGrants,
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: grantPreference, error: grantPreferenceError } = useQuery({
    queryKey: ['grantPreference', user?.id, id],
    queryFn: () => fetchGrantPreference(id || ''),
    enabled: !!id && !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  
  useEffect(() => {
    if (error) {
      toast.error('Error al cargar los detalles de la subvención');
    }
    if (recommendedGrantsError) {
      console.error('Error fetching recommended grants:', recommendedGrantsError);
    }
    if (grantPreferenceError) {
      console.error('Error fetching user preference:', grantPreferenceError);
    }
  }, [error, grantPreferenceError, recommendedGrantsError]);

  useEffect(() => {
    setUserPreference(grantPreference?.preference ?? null);
  }, [grantPreference?.preference]);
  
  const formattedDeadline = formatDeadline(match?.fecha_limite);
  const deadlineStatus = getDeadlineStatus(match?.fecha_limite);
  const deadlineStylePalette = getDeadlineStyles(deadlineStatus);
  const deadlineStyles = {
    ...deadlineStylePalette,
    icon: getDeadlineIcon(deadlineStatus, `mr-2 h-4 w-4 ${deadlineStylePalette.textColor}`),
  };
  const formattedAmount = formatAmount(match?.presupuesto || "No especificado");
  const matchPercentage = Math.round((match?.numero_match ?? 0) * 100);


  const storeUserPreference = async (grantId: string, action: 'interesa' | 'no interesa', userId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/store_user_preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({
        grant_id: grantId,
        action: action,
        user_id: userId
      }),
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

    if (!match?.grant_id) {
      toast.error('No se pudo identificar la subvención');
      return;
    }

    setLikeAnimation(true);
    setTimeout(() => setLikeAnimation(false), 600);

    setIsProcessingPreference(true);
    try {
      await storeUserPreference(match.grant_id, 'interesa', user.id);
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

    if (!match?.grant_id) {
      toast.error('No se pudo identificar la subvención');
      return;
    }

    setDislikeAnimation(true);
    setTimeout(() => setDislikeAnimation(false), 600);

    setIsProcessingPreference(true);
    try {
      await storeUserPreference(match.grant_id, 'no interesa', user.id);
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
      
      const duration = Math.random() * 3 + 2;
      const horizontalMovement = (Math.random() - 0.5) * 100;
      
      confetti.style.animation = `
        fall ${duration}s ease-in forwards,
        sway ${duration * 0.5}s ease-in-out infinite alternate
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
            transform: translateX(${horizontalMovement}px) rotate(${Math.random() * 360}deg);
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

  if (error || !match) {
    return (
      <div className="flex flex-col min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-8 flex-grow">
          <div className="w-full flex flex-col justify-center items-center h-full">
            <p className="text-red-500 mb-4">Error al cargar los detalles de la subvención</p>
            <Link to="/subvenciones-compatibles">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a las subvenciones compatibles
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider>
      <GrantDetailShell
        backHref="/subvenciones-compatibles"
        backLabel="Volver a las subvenciones compatibles"
        discoverHref="/swipe"
        detail={{
          grantId: match.grant_id,
          title: match.titulo_corto,
          amountRaw: match.presupuesto,
          amountFormatted: formattedAmount,
          deadlineFormatted: formattedDeadline,
          deadlineStyles,
          summaryHtml: match.resumen_completo,
          justificationHtml: match.justificacion,
          documentacion: match.documentacion,
          beneficiaries: match.beneficiarios,
          region: match.region_impacto,
          finalidad: match.finalidad,
          recommendationHtml: match.recomendacion,
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
            ) : recommendedGrants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {recommendedGrants.map((grant) => (
                  <MatchCard
                    key={grant.id}
                    title={grant.titulo_corto}
                    amount={grant.presupuesto}
                    deadline={grant.fecha_limite}
                    justificacion={grant.resumen_completo}
                    resumen_completo={grant.resumen_completo}
                    beneficiario={grant.beneficiarios}
                    lugar={grant.region_impacto}
                    finalidad={grant.finalidad}
                    numero_match={grant.numero_match}
                    grant_id={grant.id}
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

export default MatchDetail;
