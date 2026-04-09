import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  Download,
  FileText,
  KanbanSquare,
  Loader2,
  Scale,
  Shuffle,
  Star,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import FloatingChatButton from '@/components/FloatingChatButton';
import FloatingGrantAssistant from '@/components/FloatingGrantAssistant';

type FavoriteStatus = 'idle' | 'loading';

interface DetailRecord {
  grantId: string;
  title: string;
  amountRaw?: string;
  amountFormatted: string;
  deadlineFormatted: string;
  deadlineStyles: {
    bgColor: string;
    textColor: string;
    icon: React.ReactNode;
  };
  summaryHtml?: string;
  justificationHtml?: string;
  documentacion?: unknown;
  beneficiaries?: string;
  region?: string;
  finalidad?: string;
  recommendationHtml?: string;
  matchPercentage?: number;
}

interface ConcessionRecord {
  id?: number | string;
  referencia?: string;
  fecha_concesion?: string;
  beneficiario?: string;
  beneficiario_cif?: string | null;
  beneficiario_nombre?: string | null;
  importe?: number | string | null;
  region?: string | null;
}

interface ConcessionsResponse {
  concessions: ConcessionRecord[];
  total?: number;
  warning?: string;
  message?: string;
}

interface GrantDetailShellProps {
  backHref: string;
  backLabel: string;
  detail: DetailRecord;
  discoverHref: string;
  preferenceActions?: React.ReactNode;
  recommendedSection?: React.ReactNode;
}

const stripLeadingTitleFromSummary = (html: string | undefined, title: string) => {
  if (!html) return '';
  let output = html;

  // Remove first heading block (common format in generated summaries)
  output = output.replace(/^\s*<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>\s*/i, '');

  // If the title still appears at the start as plain text, remove it
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  output = output.replace(new RegExp(`^\\s*${escapedTitle}\\s*[:.-]?\\s*`, 'i'), '');

  return output.trim() || html;
};

const parseDocumentacionContent = (raw: unknown): string[] => {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map(String).map((v) => v.trim()).filter(Boolean);
  }
  if (typeof raw === 'object') {
    const values: string[] = [];
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          const t = String(item).trim();
          if (t) values.push(t);
        });
      } else if (value != null) {
        const t = String(value).trim();
        if (t) values.push(`${key}: ${t}`);
      }
    });
    return values;
  }

  const text = String(raw).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return parseDocumentacionContent(parsed);
  } catch {
    // continue
  }

  if (text.includes('<') && text.includes('>')) {
    const stripped = text
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|h1|h2|h3)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((line) => line.trim().replace(/^[-•]\s*/, ''))
      .filter(Boolean);
    return stripped;
  }

  if (text.includes(';')) {
    return text.split(';').map((p) => p.trim()).filter(Boolean);
  }
  return text.split('\n').map((p) => p.trim()).filter(Boolean);
};

const downloadBlob = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    let msg = 'No se pudo descargar el archivo';
    try {
      const data = await response.json();
      msg = data?.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const rawFilename = filenameMatch?.[1] ?? 'archivo';
  const filename = decodeURIComponent(rawFilename.replace(/"/g, ''));

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
};

const fetchGrantConcessions = async (grantId: string): Promise<ConcessionsResponse> => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/grants/${grantId}/concessions`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || 'No se pudieron cargar las concesiones');
  }

  return {
    concessions: Array.isArray(data?.concessions) ? data.concessions : [],
    total: typeof data?.total === 'number' ? data.total : undefined,
    warning: data?.warning,
    message: data?.message,
  };
};

const formatConcessionDate = (value?: string) => {
  if (!value) return 'No disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-ES');
};

const formatConcessionAmount = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return 'No disponible';
  let numeric: number;
  if (typeof value === 'number') {
    numeric = value;
  } else {
    const raw = String(value).trim().replace(/[^\d,.-]/g, '');
    const normalized =
      raw.includes(',') && raw.includes('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.includes(',')
          ? raw.replace(',', '.')
          : raw;
    numeric = Number(normalized);
  }
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(numeric);
};

export const GrantDetailShell: React.FC<GrantDetailShellProps> = ({
  backHref,
  backLabel,
  detail,
  discoverHref,
  preferenceActions,
  recommendedSection,
}) => {
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(false);
  const [favoriteState, setFavoriteState] = useState<FavoriteStatus>('loading');
  const [isFavorite, setIsFavorite] = useState(false);
  const [crmState, setCrmState] = useState<FavoriteStatus>('loading');
  const [isInCrm, setIsInCrm] = useState(false);
  const [isDownloadingPack, setIsDownloadingPack] = useState(false);
  const [isDownloadingBoe, setIsDownloadingBoe] = useState(false);

  const {
    data: concessionsData,
    isLoading: isLoadingConcessions,
    error: concessionsError,
  } = useQuery<ConcessionsResponse>({
    queryKey: ['grantConcessions', detail.grantId],
    queryFn: () => fetchGrantConcessions(detail.grantId),
    enabled: Boolean(detail.grantId),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [detail.grantId]);

  useEffect(() => {
    let cancelled = false;
    const loadFavoriteStatus = async () => {
      if (!detail.grantId) return;
      setFavoriteState('loading');
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/favorites/status/${detail.grantId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        if (!response.ok) {
          throw new Error('No se pudo comprobar favoritos');
        }
        const data = await response.json();
        if (!cancelled) {
          setIsFavorite(Boolean(data?.is_favorite));
          setFavoriteState('idle');
        }
      } catch {
        if (!cancelled) {
          setFavoriteState('idle');
        }
      }
    };

    loadFavoriteStatus();
    return () => {
      cancelled = true;
    };
  }, [detail.grantId]);

  useEffect(() => {
    let cancelled = false;
    const loadCrmStatus = async () => {
      if (!detail.grantId) return;
      setCrmState('loading');
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/crm/grants/status/${detail.grantId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });

        if (!response.ok) {
          throw new Error('No se pudo comprobar el CRM');
        }
        const data = await response.json();
        if (!cancelled) {
          setIsInCrm(Boolean(data?.is_in_crm));
          setCrmState('idle');
        }
      } catch {
        if (!cancelled) {
          setCrmState('idle');
        }
      }
    };

    loadCrmStatus();
    return () => {
      cancelled = true;
    };
  }, [detail.grantId]);

  const summaryWithoutTitle = useMemo(
    () => stripLeadingTitleFromSummary(detail.summaryHtml || '', detail.title),
    [detail.summaryHtml, detail.title]
  );

  const documentacionItems = useMemo(
    () => parseDocumentacionContent(detail.documentacion),
    [detail.documentacion]
  );

  const toggleFavorite = async () => {
    try {
      setFavoriteState('loading');
      const endpoint = isFavorite ? 'remove' : 'add';
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/favorites/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ grant_id: detail.grantId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo actualizar favoritos');
      }

      setIsFavorite((prev) => !prev);
      toast.success(isFavorite ? 'Subvención eliminada de favoritos' : 'Subvención guardada en favoritos');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar favoritos');
    } finally {
      setFavoriteState('idle');
    }
  };

  const handleCrmAction = async () => {
    if (!detail.grantId) return;
    if (isInCrm) {
      navigate('/crm');
      return;
    }

    try {
      setCrmState('loading');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/crm/grants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ grant_id: detail.grantId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || 'No se pudo añadir la subvención al CRM');
      }

      setIsInCrm(true);
      toast.success('Subvención añadida al CRM', {
        description: 'Ya puedes gestionarla desde tu pipeline y calendario.',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo añadir la subvención al CRM');
    } finally {
      setCrmState('idle');
    }
  };

  const handleDownloadPack = async () => {
    setIsDownloadingPack(true);
    try {
      await downloadBlob(`${import.meta.env.VITE_API_URL}/api/grants/${detail.grantId}/download-pack`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      toast.success('Dossier descargado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar el dossier');
    } finally {
      setIsDownloadingPack(false);
    }
  };

  const handleDownloadBoe = async () => {
    setIsDownloadingBoe(true);
    try {
      await downloadBlob(`${import.meta.env.VITE_API_URL}/api/grants/${detail.grantId}/download-boe`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      toast.success('Normativa legal descargada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar la normativa');
    } finally {
      setIsDownloadingBoe(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background md:pl-20">
      <div className="container mx-auto px-2 md:px-4 py-6 md:py-8 pb-20 md:pb-8">
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <Link to={backHref}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-xs md:text-sm text-muted-foreground">{backLabel}</span>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4 md:gap-6 mb-8 md:mb-10">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{detail.title}</h1>
                <div className="flex flex-wrap gap-2 mt-4">
                  {typeof detail.matchPercentage === 'number' && (
                    <span className="text-sm px-2.5 py-1 rounded-full font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                      {detail.matchPercentage}%
                    </span>
                  )}
                  <div className={`flex items-center text-sm font-medium px-2.5 py-1 rounded-full ${detail.deadlineStyles.bgColor}`}>
                    {detail.deadlineStyles.icon}
                    <span className={`${detail.deadlineStyles.textColor}`}>
                      Plazo: {detail.deadlineFormatted}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  variant={isInCrm ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleCrmAction}
                  disabled={crmState === 'loading'}
                  className={isInCrm ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}
                >
                  {crmState === 'loading' ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <KanbanSquare className="h-4 w-4 mr-2" />
                  )}
                  {isInCrm ? 'Ir al CRM' : 'Añadir al CRM'}
                </Button>

                <Button
                  variant={isFavorite ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleFavorite}
                  disabled={favoriteState === 'loading'}
                  className={isFavorite ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : ''}
                >
                  {favoriteState === 'loading' ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Star className={`h-4 w-4 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                  )}
                  {isFavorite ? 'En favoritos' : 'Guardar en favoritos'}
                </Button>
              </div>
            </div>

            {preferenceActions}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-8 space-y-8">
              <section className="bg-card border rounded-lg p-4 md:p-6 shadow-sm">
                <Tabs defaultValue="resumen" className="w-full">
                  <TabsList className="w-full justify-start flex-wrap h-auto">
                    <TabsTrigger value="resumen">Resumen</TabsTrigger>
                    <TabsTrigger value="compatibilidad">Evaluación</TabsTrigger>
                    <TabsTrigger value="docs">Documentos a Presentar</TabsTrigger>
                    <TabsTrigger value="concesiones">
                      Concesiones{typeof concessionsData?.total === 'number' ? ` (${concessionsData.total})` : ''}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="resumen" className="pt-3">
                    <div
                      className="grant-summary-content"
                      dangerouslySetInnerHTML={{ __html: summaryWithoutTitle || 'Sin resumen disponible' }}
                    />
                  </TabsContent>

                  <TabsContent value="compatibilidad" className="pt-3">
                    <div className="mb-3 text-sm text-muted-foreground">
                      Esta pestaña te ayuda a entender por qué esta subvención tiene este porcentaje
                      de compatibilidad con tu empresa y qué factores influyen en el encaje.
                    </div>
                    <div
                      className="grant-summary-content"
                      dangerouslySetInnerHTML={{ __html: detail.justificationHtml || 'Sin justificación disponible' }}
                    />
                  </TabsContent>

                  <TabsContent value="docs" className="pt-3">
                    {documentacionItems.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Documentación orientativa a preparar para presentar la solicitud:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-sm">
                          {documentacionItems.map((item, index) => (
                            <li key={`${item}-${index}`} className="text-foreground">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Aún no hay documentación estructurada disponible para esta subvención.
                        Cuando se complete la columna <code>Documentacion</code> en `grants`, aquí se
                        mostrará la lista de documentos a aportar.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="concesiones" className="pt-3">
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground">
                        Consulta qué entidades han recibido esta ayuda en concesiones publicadas de la convocatoria,
                        con importes, fecha de concesión y región.
                      </div>

                      {concessionsData?.warning ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                          {concessionsData.warning}
                        </div>
                      ) : null}

                      {isLoadingConcessions ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Cargando concesiones...</span>
                        </div>
                      ) : concessionsError ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No se pudieron cargar las concesiones de esta convocatoria.
                        </div>
                      ) : (concessionsData?.concessions || []).length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Aún no hay concesiones publicadas disponibles por el momento.
                        </div>
                      ) : (
                        <div className="rounded-lg border overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[680px] text-sm">
                              <thead className="bg-muted/40">
                                <tr className="text-left">
                                  <th className="px-4 py-3 font-medium">Beneficiario</th>
                                  <th className="px-4 py-3 font-medium">Importe</th>
                                  <th className="px-4 py-3 font-medium">Fecha concesión</th>
                                  <th className="px-4 py-3 font-medium">Región</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(concessionsData?.concessions || []).map((row, index) => {
                                  const rowKey = `${row.id || row.referencia || row.beneficiario || 'concesion'}-${index}`;
                                  return (
                                    <tr key={rowKey} className="border-t align-top">
                                      <td className="px-4 py-3">
                                        <div className="min-w-0">
                                          {row.beneficiario_cif ? (
                                            <div className="mb-1">
                                              <span className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                {row.beneficiario_cif}
                                              </span>
                                            </div>
                                          ) : null}
                                          <div className="font-medium text-foreground leading-snug">
                                            {row.beneficiario_nombre || row.beneficiario || 'No disponible'}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        {formatConcessionAmount(row.importe)}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        {formatConcessionDate(row.fecha_concesion)}
                                      </td>
                                      <td className="px-4 py-3">
                                        {row.region || 'No disponible'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </section>
            </div>

            <div className="md:col-span-4 space-y-6">
              <section className="bg-card border rounded-lg p-5 shadow-sm">
                <h3 className="font-semibold mb-4">Resumen rápido</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plazo</p>
                    <p className="text-foreground font-medium">{detail.deadlineFormatted}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fondos disponibles</p>
                    <p className="text-foreground font-medium">{detail.amountFormatted || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Región</p>
                    <p className="text-foreground font-medium">{detail.region || 'No especificada'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cuantía para el beneficiario</p>
                    <p className="text-foreground font-medium">{detail.amountFormatted || 'Consultar bases'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Beneficiario</p>
                    <p className="text-foreground font-medium">{detail.beneficiaries || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Finalidad</p>
                    <p className="text-foreground font-medium">{detail.finalidad || 'No disponible'}</p>
                  </div>
                </div>
              </section>

              <section className="bg-card border rounded-lg p-5 shadow-sm">
                <h3 className="font-semibold mb-3">Descargar Documentos</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Descarga un dossier con resumen, justificación y documentación, o la normativa legal de la convocatoria.
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full" variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Descargar Documentos
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuItem
                      onClick={handleDownloadPack}
                      disabled={isDownloadingPack}
                      className="cursor-pointer"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {isDownloadingPack ? 'Generando dossier...' : 'Dossier (Word .docx)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDownloadBoe}
                      disabled={isDownloadingBoe}
                      className="cursor-pointer"
                    >
                      <Scale className="h-4 w-4 mr-2" />
                      {isDownloadingBoe ? 'Buscando normativa...' : 'Normativa legal (BOE)'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </section>

              <Link to={discoverHref} className="block">
                <section className="bg-card border border-primary/20 rounded-lg p-5 shadow-sm hover:bg-primary/5 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Shuffle className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-medium">Descubrir más subvenciones</h3>
                      <p className="text-sm text-muted-foreground">Explora y evalúa otras subvenciones disponibles</p>
                    </div>
                  </div>
                </section>
              </Link>

              {detail.recommendationHtml && (
                <section className="grant-tips-section">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <span className="text-lg">💡</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold mb-2 text-amber-900 dark:text-amber-100">
                        Mejora tu compatibilidad
                      </h2>
                      <div
                        className="grant-tips-content"
                        dangerouslySetInnerHTML={{ __html: detail.recommendationHtml }}
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          {recommendedSection}
        </div>
      </div>

      <FloatingChatButton onClick={() => setShowChat((v) => !v)} isOpen={showChat} />

      {showChat && (
        <div className="fixed bottom-24 right-6 z-50">
          <FloatingGrantAssistant
            onClose={() => setShowChat(false)}
            grantTitle={detail.title}
            grantAmount={detail.amountFormatted}
            grantDeadline={detail.deadlineFormatted}
            grantDescription={detail.summaryHtml || ''}
          />
        </div>
      )}
    </div>
  );
};

export default GrantDetailShell;
