import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Check, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatAmount } from '@/lib/utils';
import { formatDeadline, getDeadlineIcon, getDeadlineStatus, getDeadlineStyles } from '@/lib/deadline';
import { useAuth } from '@/context/AuthContext';
import { trackRecoEvent } from '@/lib/recoEvents';
import { type SwipeDecision, type HistoricalInsights } from '@/lib/preferenceInsights';
import PreferenceInsights from '@/components/PreferenceInsights';

interface Grant {
  id: string;
  title: string;
  amount: string;
  deadline: string;
  description: string;  
  beneficiario: string;
  lugar: string;
  finalidad?: string;
}

// Configuración para llamar la API
const apiUrl= import.meta.env.VITE_API_URL;

const truncateTitle = (title: string, maxWords: number = 6): string => {
  if (!title) return "Sin título";
  const words = title.split(' ');
  if (words.length <= maxWords) {
    return title;
  }
  return words.slice(0, maxWords).join(' ') + '...';
};


const stripHtml = (html?: string): string => {
  if (!html) return '';
  const el = document.createElement('div');
  el.innerHTML = html;
  
  // Reemplazar elementos de bloque con saltos de línea
  const blockElements = el.querySelectorAll('p, div, br, h1, h2, h3, h4, h5, h6, li');
  blockElements.forEach(elem => {
    if (elem.tagName === 'BR') {
      elem.replaceWith('\n');
    } else {
      const textNode = document.createTextNode('\n');
      elem.after(textNode);
    }
  });
  
  let text = el.textContent || el.innerText || '';
  
  // Limpiar espacios múltiples pero mantener saltos de línea
  text = text.replace(/[ \t]+/g, ' ').trim();
  
  // Añadir salto de línea después de cada punto seguido de mayúscula
  // Esto separa las oraciones en líneas diferentes
  text = text.replace(/\.\s+([A-ZÑÁÉÍÓÚ])/g, '.\n$1');
  
  // Añadir salto de línea después de preguntas
  text = text.replace(/\?\s+([A-ZÑÁÉÍÓÚ])/g, '?\n$1');
  
  return text.trim();
};

const removeTitleFromPreviewText = (html: string | undefined, title: string): string => {
  if (!html) return '';

  // Quitar el primer heading del HTML si existe (resúmenes suelen venir con título)
  const htmlWithoutHeading = html.replace(/^\s*<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>\s*/i, '');
  let text = stripHtml(htmlWithoutHeading);

  const safeTitle = stripHtml(title).trim();
  if (!safeTitle) return text;

  const escapedTitle = safeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text.replace(new RegExp(`^\\s*${escapedTitle}\\s*[:.-]?\\s*`, 'i'), '');

  return text.trim();
};

const removeTitleFromPreviewHtml = (html: string | undefined, title: string): string => {
  if (!html) return '';

  let htmlWithoutHeading = html.replace(/^\s*<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>\s*/i, '');
  const safeTitle = stripHtml(title).trim();

  if (!safeTitle) return htmlWithoutHeading;

  const escapedTitle = safeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Elimina una repetición del título al inicio si viene como texto dentro del primer párrafo
  htmlWithoutHeading = htmlWithoutHeading.replace(
    new RegExp(`^\\s*<p[^>]*>\\s*${escapedTitle}\\s*[:.-]?\\s*`, 'i'),
    (match) => match.replace(new RegExp(escapedTitle, 'i'), '')
  );

  return htmlWithoutHeading;
};

interface UserPreferencesResponse {
  likes: string[];
  dislikes: string[];
  insights: HistoricalInsights | null;
}

const fetchUserPreferences = async (userId: string | undefined): Promise<UserPreferencesResponse> => {
  if (!userId) {
    return { likes: [], dislikes: [], insights: null };
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_user_preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: JSON.stringify({
        user_id: userId
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Rate limited while fetching user preferences');
        return { likes: [], dislikes: [], insights: null };
      }
      const bodyText = await response.text().catch(() => '');
      console.error('Error al obtener preferencias:', bodyText.slice(0, 240));
      return { likes: [], dislikes: [], insights: null };
    }

    const data = await response.json();
    const prefs = data.preferences || { likes: [], dislikes: [] };
    return {
      likes: prefs.likes,
      dislikes: prefs.dislikes,
      insights: data.insights || null,
    };
  } catch (error) {
    console.error('Error al obtener preferencias:', error);
    return { likes: [], dislikes: [], insights: null };
  }
};


const fetchGrants = async (userId: string | undefined, evaluatedGrantIds: string[] = []): Promise<Grant[]> => {
  try {
    const response = await fetch(`${apiUrl}/api/get_grants_for_swipe`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return [];
      }
      throw new Error(`Error al obtener subvenciones (${response.status})`);
    }

    const data = await response.json();

    const formattedGrants = data.grants.map(grant => ({
      ...grant,
      deadline: formatDeadline(grant.deadline)
    }));

    // Filtrar subvenciones que ya fueron evaluadas
    const newGrants = formattedGrants.filter(grant => !evaluatedGrantIds.includes(grant.id));

    return newGrants || [];
  } catch (error) {
    console.error('Error fetching grants for swipe:', error);
    return [];
  }
};

const storeUserPreference = async (grantId: string, action: 'interesa' | 'no interesa', userId: string | undefined): Promise<boolean> => {
  if (!userId) {
    console.error('No hay usuario autenticado');
    return false;
  }
  try {
    const response = await fetch(`${apiUrl}/api/store_user_preference`, {
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
        console.warn('Rate limited while storing preference');
        return false;
      }

      const contentType = response.headers.get('content-type') || '';
      let errorMessage = `Error al almacenar preferencia (${response.status})`;
      if (contentType.includes('application/json')) {
        const payload = await response.json().catch(() => null);
        if (payload?.error || payload?.message) {
          errorMessage = String(payload.error || payload.message);
        }
      } else {
        const raw = await response.text().catch(() => '');
        if (raw.toLowerCase().includes('error 1015') || raw.toLowerCase().includes('rate limited')) {
          errorMessage = 'Cloudflare está limitando temporalmente las solicitudes.';
        }
      }
      console.error(errorMessage);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error al almacenar preferencia:', error);
    return false;
  }
};

const GrantCard = ({ grant, onSwipe, onCardClick }) => {
  const SWIPE_THRESHOLD = 50;
  
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    
    if (offset.x < -SWIPE_THRESHOLD) {
      onSwipe('left');
    } else if (offset.x > SWIPE_THRESHOLD) {
      onSwipe('right');
    }
  };
  
  // --- Asegurar limpieza por si llegara sin mapear ---
  const cleanTitle = stripHtml(grant.title);
  const cleanDescription = removeTitleFromPreviewText(grant.description, cleanTitle);
  const previewHtml = removeTitleFromPreviewHtml(grant.description, cleanTitle);
  const cleanBeneficiario = stripHtml(grant.beneficiario);
  const cleanLugar = stripHtml(grant.lugar);
  const truncatedTitle = truncateTitle(cleanTitle);

  return (
      <motion.div
        className="absolute w-full max-w-md bg-card shadow-lg rounded-xl overflow-hidden cursor-pointer select-none"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        whileTap={{ scale: 0.98 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ x: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        // ⬇️ solo abre el modal si NO hubo drag
        onTap={() => onCardClick(grant)}
        onDragEnd={(event, info) => {
          const { offset } = info;
          if (offset.x < -SWIPE_THRESHOLD) onSwipe('left');
          else if (offset.x > SWIPE_THRESHOLD) onSwipe('right');
        }}
      >
      <div className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">{truncatedTitle}</h3>
        <div className="mb-4 rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="relative max-h-40 overflow-hidden">
            {previewHtml ? (
              <>
                <div
                  className="grant-summary-content text-sm [&_h1]:text-base [&_h1]:mb-2 [&_h1]:mt-0 [&_h2]:text-sm [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:text-sm [&_p]:leading-6 [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:text-sm [&_li]:mb-1"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted/30 via-muted/20 to-transparent" />
              </>
            ) : (
              <p className="text-muted-foreground dark:text-gray-300 text-sm leading-relaxed">
                {cleanDescription || 'Sin descripción'}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex flex-col space-y-2">
            <div className="flex justify">
              <span className="text-sm font-medium mr-1 text-foreground">Beneficiario:</span>
              <span className="text-sm text-muted-foreground dark:text-gray-300">{cleanBeneficiario}</span>
            </div>
            <div className="flex justify">
              <span className="text-sm font-medium mr-1 text-foreground">Lugar:</span>
              <span className="text-sm text-muted-foreground dark:text-gray-300">{cleanLugar}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="text-xs text-muted-foreground">Haz clic para ver detalles</p>
        </div>
      </div>
    </motion.div>
  );
};

const ActionButtons = ({ onSwipe }) => {
  return (
    <div className="flex justify-center gap-8 mt-4">
      <Button
        variant="outline"
        size="icon"
        className="h-14 w-14 rounded-full border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:bg-opacity-30"
        onClick={() => onSwipe('left')}
      >
        <X className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-14 w-14 rounded-full border-green-500 text-green-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950 dark:hover:bg-opacity-30"
        onClick={() => onSwipe('right')}
      >
        <Check className="h-6 w-6" />
      </Button>
    </div>
  );
};

const DecisionsHistory = ({ swiped, panelHeight }: { swiped: SwipeDecision[]; panelHeight?: number | null }) => {
  const navigate = useNavigate();

  const truncateTitleWithEllipsis = (title: string) => {
    const words = title.split(' ');
    return words.length > 4 
      ? words.slice(0, 4).join(' ') + '...' 
      : title;
  };

  const handleViewGrant = (grantId: string) => {
    navigate(`/grants/${grantId}`);
  };

  return (
    <Card
      className="h-full w-full shadow-md border border-border"
      style={panelHeight ? { height: `${panelHeight}px` } : undefined}
    >
      <CardContent className="flex h-full min-h-0 flex-col p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="font-medium text-foreground">Tus decisiones:</h3>
          <Link to="/subvenciones-compatibles">
            <Button variant="ghost" size="sm" className="text-primary dark:text-primary-foreground flex items-center gap-1 p-1 h-7">
              <Target className="h-3.5 w-3.5" />
              <span className="text-xs">Ver compatibles</span>
            </Button>
          </Link>
        </div>
        <Separator className="my-2" />
        {swiped.length === 0 ? (
          <div className="mt-3 flex flex-1 items-start rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            Aquí verás las subvenciones que has marcado como interesantes o descartadas a medida que hagas swipe.
          </div>
        ) : (
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {[...swiped].reverse().map((item) => (
              <div 
                key={item.id} 
                onClick={() => handleViewGrant(item.id)}
                className="flex justify-between items-center p-2 bg-background rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs truncate mr-2 text-foreground">
                  {truncateTitleWithEllipsis(item.title)}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${
                  item.action === 'interesa' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {item.action === 'interesa' ? '✅' : '❌'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Función para guardar decisiones en localStorage con timestamp
const saveDecisionsToLocalStorage = (decisions) => {
  const dataToStore = {
    decisions,
    timestamp: Date.now()
  };
  localStorage.setItem('grantSwipeDecisions', JSON.stringify(dataToStore));
};

// Función para cargar decisiones de localStorage (solo si son menores a 24 horas)
const loadDecisionsFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem('grantSwipeDecisions');
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
    
    if (now - data.timestamp > twentyFourHours) {
      // Si han pasado más de 24 horas, limpiar localStorage
      localStorage.removeItem('grantSwipeDecisions');
      return [];
    }
    
    return data.decisions || [];
  } catch (error) {
    console.error('Error al cargar decisiones de localStorage:', error);
    return [];
  }
};

const GrantSwipe = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<string | null>(null);
  const [swiped, setSwiped] = useState<SwipeDecision[]>([]);
  const [selectedGrant, setSelectedGrant] = useState<Grant | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResettingInterests, setIsResettingInterests] = useState(false);
  const impressedGrantIdsRef = useRef<Set<string>>(new Set());
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const [decisionsPanelHeight, setDecisionsPanelHeight] = useState<number | null>(null);

  // Fetch historical preferences (insights + evaluated IDs)
  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences', user?.id],
    queryFn: () => fetchUserPreferences(user?.id),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const evaluatedGrantIds = userPrefs ? [...userPrefs.likes, ...userPrefs.dislikes] : [];
  const historicalInsights = userPrefs?.insights ?? null;

  const { data: grants = [], isLoading, error } = useQuery<Grant[]>({
    queryKey: ['grantsForSwipe', user?.id, evaluatedGrantIds.length],
    queryFn: () => fetchGrants(user?.id, evaluatedGrantIds),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id && !!userPrefs,
  });

  const currentGrant = grants[currentIndex];

  useEffect(() => {
    if (!currentGrant?.id) return;
    if (impressedGrantIdsRef.current.has(currentGrant.id)) return;

    impressedGrantIdsRef.current.add(currentGrant.id);
    void trackRecoEvent({
      eventType: 'impression',
      grantId: currentGrant.id,
      surface: 'swipe',
      position: currentIndex + 1,
      metadata: { source: 'GrantSwipe' },
    });
  }, [currentGrant?.id, currentIndex]);

  // Cargar decisiones previas al inicializar el componente (solo de la sesión actual)
  useEffect(() => {
    if (!user?.id) return;
    
    // Solo cargar decisiones de la sesión actual desde localStorage
    const localDecisions = loadDecisionsFromLocalStorage();
    setSwiped(localDecisions);
  }, [user?.id]);

  useEffect(() => {
    if (error) {
      toast.error('Error al cargar las subvenciones');
    }
  }, [error]);

  useEffect(() => {
    const leftColumn = leftColumnRef.current;
    if (!leftColumn || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const updatePanelHeight = () => {
      if (!mediaQuery.matches) {
        setDecisionsPanelHeight(null);
        return;
      }

      setDecisionsPanelHeight(Math.ceil(leftColumn.getBoundingClientRect().height));
    };

    updatePanelHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updatePanelHeight()) : null;
    resizeObserver?.observe(leftColumn);
    window.addEventListener('resize', updatePanelHeight);

    const handleMediaChange = () => updatePanelHeight();
    mediaQuery.addEventListener?.('change', handleMediaChange);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePanelHeight);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const selectedGrantDeadlineStatus = getDeadlineStatus(selectedGrant?.deadline);
  const selectedGrantDeadlineStyles = getDeadlineStyles(selectedGrantDeadlineStatus);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!currentGrant || currentIndex >= grants.length) return;
    
    setDirection(direction);
    
    const action = direction === 'right' ? 'interesa' : 'no interesa';
    const newDecision: SwipeDecision = {
      id: currentGrant.id,
      title: truncateTitle(currentGrant.title, 5),
      action,
      beneficiario: currentGrant.beneficiario,
      lugar: currentGrant.lugar,
      finalidad: currentGrant.finalidad,
    };
    
    const updatedSwiped = [...swiped, newDecision];
    setSwiped(updatedSwiped);
    
    // Guardar en localStorage con timestamp
    saveDecisionsToLocalStorage(updatedSwiped);
    
    storeUserPreference(currentGrant.id, action, user?.id)
      .then(success => {
        if (!success) {
          console.error('No se pudo guardar la preferencia');
        }
      });

    void trackRecoEvent({
      eventType: action === 'interesa' ? 'like' : 'dislike',
      grantId: currentGrant.id,
      surface: 'swipe',
      position: currentIndex + 1,
      metadata: { source: 'GrantSwipe' },
    });
    
    if (direction === 'right') {
      toast.success(`Subvención guardada: ${truncateTitle(currentGrant.title)}`);
    } else {
      toast.info(`Subvención descartada`);
    }
    
    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
      setDirection(null);
    }, 300);
  };

  const handleCardClick = (grant: Grant) => {
    setSelectedGrant(grant);
    setIsModalOpen(true);
    void trackRecoEvent({
      eventType: 'detail_open',
      grantId: grant.id,
      surface: 'swipe_modal',
      position: currentIndex + 1,
      metadata: { source: 'GrantSwipe' },
    });
  };

  const handleOpenFullGrantDetails = () => {
    if (!selectedGrant?.id) return;
    const detailsUrl = `${window.location.origin}/grants/${selectedGrant.id}`;
    window.open(detailsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleResetInterests = async () => {
    if (!user?.id) {
      toast.error('Debes iniciar sesión para resetear tus intereses');
      return;
    }

    try {
      setIsResettingInterests(true);

      const response = await fetch(`${apiUrl}/api/reset_user_interests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || payload?.message || 'No se pudieron resetear los intereses');
        }
        throw new Error('No se pudieron resetear los intereses');
      }

      localStorage.removeItem('grantSwipeDecisions');
      impressedGrantIdsRef.current.clear();
      setSwiped([]);
      setCurrentIndex(0);
      setDirection(null);
      setSelectedGrant(null);
      setIsModalOpen(false);

      queryClient.setQueryData<UserPreferencesResponse>(['userPreferences', user.id], {
        likes: [],
        dislikes: [],
        insights: null,
      });
      queryClient.removeQueries({ queryKey: ['grantsForSwipe', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['userPreferences', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['grantsForSwipe', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['recommendedGrants', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['grantPreference', user.id] });

      toast.success('Tus intereses se han reseteado correctamente');
    } catch (error) {
      console.error('Error resetting interests:', error);
      const message = error instanceof Error ? error.message : 'No se pudieron resetear los intereses';
      toast.error(message);
      throw error;
    } finally {
      setIsResettingInterests(false);
    }
  };

  

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pt-4 pb-4 px-3 sm:px-4">
        <div className="relative mx-auto w-full max-w-[1400px]">
          <div className="mt-8 sm:mt-12 flex flex-col gap-6 sm:gap-8">
            <div className="grid w-full gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
              <div ref={leftColumnRef} className="flex w-full flex-col items-center">
                <div className="mx-auto mb-4 sm:mb-6 w-full max-w-md text-center px-1">
                  <h2 className="mb-3 text-xl sm:text-2xl font-bold text-foreground">Define tus preferencias</h2>
                  <p className="mb-2 text-sm sm:text-base text-muted-foreground dark:text-gray-300">
                    Ayuda al asistente a identificar qué ayudas te interesan más.
                  </p>
                  <p className="text-sm sm:text-base text-muted-foreground dark:text-gray-300">
                    Desliza a la <strong className="text-primary dark:text-primary-foreground">derecha</strong> si te interesa, o a la <strong className="text-primary dark:text-primary-foreground">izquierda</strong> si no.
                  </p>
                </div>

                <div className="relative w-full max-w-md h-[360px] sm:h-[400px] mx-auto mb-4">
                  {isLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-card rounded-xl p-6">
                      <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                      <p className="text-muted-foreground dark:text-gray-300">Cargando subvenciones...</p>
                    </div>
                  ) : currentIndex < grants.length ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentGrant.id}
                        className="absolute w-full h-full"
                        exit={{
                          x: direction === 'left' ? -300 : direction === 'right' ? 300 : 0,
                          opacity: 0,
                          transition: { duration: 0.2 }
                        }}
                      >
                        <GrantCard
                          grant={currentGrant}
                          onSwipe={handleSwipe}
                          onCardClick={handleCardClick}
                        />
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-card rounded-xl p-6">
                      <h3 className="text-xl font-semibold mb-2 text-foreground">¡No hay más subvenciones!</h3>
                      <p className="text-muted-foreground dark:text-gray-300 text-center mb-4">
                        Has revisado todas las subvenciones disponibles.
                      </p>
                      <div className="space-y-3">
                        <Link to="/subvenciones" className="block">
                          <Button
                            onClick={() => {
                              setCurrentIndex(0);
                              setSwiped([]);
                              setDirection(null);
                              localStorage.removeItem('grantSwipeDecisions');
                            }}
                            className="w-full"
                          >
                            Buscar subvenciones
                          </Button>
                        </Link>
                        <Link to="/subvenciones-compatibles" className="block">
                          <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                            <Target className="h-4 w-4" />
                            Ver subvenciones compatibles
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {currentIndex < grants.length && !isLoading && (
                  <div className="flex flex-col items-center w-full max-w-md">
                    <div className="mt-2">
                      <ActionButtons onSwipe={handleSwipe} />
                    </div>
                  </div>
                )}
              </div>

              <aside className="w-full min-h-0 xl:h-full">
                <DecisionsHistory swiped={swiped} panelHeight={decisionsPanelHeight} />
              </aside>
            </div>

            <div className="w-full">
              <PreferenceInsights
                swiped={swiped}
                historical={historicalInsights}
                onResetInterests={handleResetInterests}
                isResettingInterests={isResettingInterests}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modal de detalles de subvención */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {selectedGrant?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedGrant && (
            <div className="space-y-6">
              {/* Información principal */}
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 md:p-5">
                <h4 className="font-semibold text-foreground mb-3">Resumen rápido</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Fondos totales</p>
                    <p className="font-semibold text-foreground">{formatAmount(selectedGrant.amount)}</p>
                  </div>

                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Beneficiario</p>
                    <p className="font-semibold text-foreground">{selectedGrant.beneficiario || 'No especificado'}</p>
                  </div>

                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Plazo</p>
                    <div className={`flex items-center font-semibold ${selectedGrantDeadlineStyles.textColor}`}>
                      {getDeadlineIcon(selectedGrantDeadlineStatus, `mr-1 h-3 w-3 ${selectedGrantDeadlineStyles.textColor}`)}
                      <span>{selectedGrant.deadline}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Cuantía para el beneficiario</p>
                    <p className="font-semibold text-foreground">{formatAmount(selectedGrant.amount)}</p>
                  </div>

                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lugar</p>
                    <p className="font-semibold text-foreground">{selectedGrant.lugar || 'No especificado'}</p>
                  </div>

                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Finalidad</p>
                    <p className="font-semibold text-foreground">{selectedGrant.finalidad || 'No especificado'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleOpenFullGrantDetails}
                >
                  Ver Todos los Detalles
                </Button>
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">Resumen de la subvención</h4>
                <div
                  className="grant-summary-content"
                  dangerouslySetInnerHTML={{ __html: selectedGrant?.description || "Sin descripción" }}
                />
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleSwipe('left');
                    setIsModalOpen(false);
                  }}
                  className="sm:flex-1 border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:bg-opacity-30"
                >
                  <X className="mr-2 h-4 w-4" />
                  No me interesa
                </Button>
                <Button
                  onClick={() => {
                    handleSwipe('right');
                    setIsModalOpen(false);
                  }}
                  className="sm:flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Me interesa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrantSwipe;
