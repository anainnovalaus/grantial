import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import type { DayContentProps } from 'react-day-picker';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  KanbanSquare,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDeadlineIcon, getDeadlineStatus, getDeadlineStyles } from '@/lib/deadline';
import {
  CRM_PIPELINE_STATUSES,
  formatCompactFileSize,
  getCrmStatusBadgeClass,
  getCrmStatusLabel,
} from '@/lib/crm';
import { fetchWithTimeout } from '@/lib/api';
import { cn } from '@/lib/utils';

const apiUrl = import.meta.env.VITE_API_URL;
const EXTRA_DOCUMENT_TYPE_CODE = 'documentacion_extra';
const EXPORT_TIMEOUT_MS = 300000;

interface CrmGrant {
  id: number;
  grant_id: string;
  status: string;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  titulo_corto: string;
  fondos_totales: string;
  importe_beneficiario: string;
  fecha_inicio?: string | null;
  fecha_inicio_display: string;
  fecha_limite?: string | null;
  fecha_limite_display: string;
  region: string;
  finalidad: string;
}

interface CrmGrantResponse {
  success: boolean;
  grants: CrmGrant[];
  count: number;
  entity_id: string;
}

interface CorporateDocumentRecord {
  id: number;
  filename: string;
  file_size?: number | null;
  mime_type?: string | null;
  status: string;
  upload_date?: string | null;
  document_type_code?: string | null;
  document_type_label?: string | null;
}

interface CorporateDocumentItem {
  document_type_code: string;
  label: string;
  description?: string | null;
  display_order: number;
  has_file: boolean;
  document: CorporateDocumentRecord | null;
}

interface CorporateDocumentsResponse {
  success: boolean;
  items: CorporateDocumentItem[];
  extra_documents: CorporateDocumentRecord[];
  extra_documents_count: number;
  uploaded_count: number;
  missing_count: number;
  total_required: number;
  total_current_documents: number;
  entity_id: string;
}

interface CalendarEvent {
  id: string;
  grantId: string;
  title: string;
  type: 'start' | 'deadline';
  date: Date;
  dateLabel: string;
}

interface PendingDeleteGrant {
  id: number;
  title: string;
}

interface PendingDeleteDocument {
  id: number;
  filename: string;
  slotLabel: string;
}

const parseBackendDate = (value?: string | null) => {
  if (!value) return null;

  try {
    const parsedIso = parseISO(value);
    if (isValid(parsedIso)) return parsedIso;
  } catch {
    // ignore
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const fetchCrmGrants = async (): Promise<CrmGrantResponse> => {
  const response = await fetch(`${apiUrl}/api/crm/grants`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo cargar el CRM (${response.status})`);
  }

  return payload as CrmGrantResponse;
};

const fetchCorporateDocuments = async (): Promise<CorporateDocumentsResponse> => {
  const response = await fetch(`${apiUrl}/api/crm/corporate-documents`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo cargar la documentación corporativa (${response.status})`);
  }

  return payload as CorporateDocumentsResponse;
};

const updateCrmStatus = async ({ pipelineId, status }: { pipelineId: number; status: string }) => {
  const response = await fetch(`${apiUrl}/api/crm/grants/${pipelineId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
    body: JSON.stringify({ status }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo actualizar el estado (${response.status})`);
  }

  return payload;
};

const deleteCrmGrant = async (pipelineId: number) => {
  const response = await fetch(`${apiUrl}/api/crm/grants/${pipelineId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo eliminar la subvención (${response.status})`);
  }

  return payload;
};

const deleteCorporateDocument = async (documentId: number) => {
  const response = await fetch(`${apiUrl}/api/crm/corporate-documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo eliminar el documento (${response.status})`);
  }

  return payload;
};

const uploadCorporateDocument = async ({
  documentTypeCode,
  file,
}: {
  documentTypeCode: string;
  file: File;
}) => {
  const formData = new FormData();
  formData.append('document_type_code', documentTypeCode);
  formData.append('file', file);

  const response = await fetch(`${apiUrl}/api/crm/corporate-documents/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo subir el documento (${response.status})`);
  }

  return payload;
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(blobUrl);
};

const getResponseFilename = (response: Response, fallback: string) => {
  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  const rawFilename = filenameMatch?.[1] ?? fallback;
  return decodeURIComponent(rawFilename.replace(/"/g, ''));
};

const downloadCorporateDocument = async (documentId: number) => {
  const response = await fetch(`${apiUrl}/api/crm/corporate-documents/${documentId}/download`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `No se pudo descargar el documento (${response.status})`);
  }

  const blob = await response.blob();
  const filename = getResponseFilename(response, `documento_${documentId}`);
  triggerBlobDownload(blob, filename);
};

const exportCorporateDocumentsZip = async () => {
  const response = await fetchWithTimeout(
    `${apiUrl}/api/crm/corporate-documents/export`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        Accept: 'application/zip',
      },
      cache: 'no-store',
    },
    EXPORT_TIMEOUT_MS,
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `No se pudo exportar la documentación (${response.status})`);
  }

  const blob = await response.blob();
  const filename = getResponseFilename(response, 'documentacion_entidad.zip');
  triggerBlobDownload(blob, filename);
};

const Crm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [deletingPipelineId, setDeletingPipelineId] = useState<number | null>(null);
  const [uploadingDocumentCode, setUploadingDocumentCode] = useState<string | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const [isExportingDocuments, setIsExportingDocuments] = useState(false);
  const [pendingDeleteGrant, setPendingDeleteGrant] = useState<PendingDeleteGrant | null>(null);
  const [pendingDeleteDocument, setPendingDeleteDocument] = useState<PendingDeleteDocument | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);

  const {
    data: crmData,
    isLoading: isLoadingCrm,
    error: crmError,
    refetch: refetchCrm,
  } = useQuery({
    queryKey: ['crmGrants'],
    queryFn: fetchCrmGrants,
  });

  const {
    data: corporateDocumentsData,
    isLoading: isLoadingDocuments,
    error: documentsError,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ['crmCorporateDocuments'],
    queryFn: fetchCorporateDocuments,
  });

  const grants = useMemo(() => crmData?.grants ?? [], [crmData?.grants]);
  const corporateDocuments = useMemo(
    () => corporateDocumentsData?.items ?? [],
    [corporateDocumentsData?.items],
  );
  const extraDocuments = useMemo(
    () => corporateDocumentsData?.extra_documents ?? [],
    [corporateDocumentsData?.extra_documents],
  );

  const updateStatusMutation = useMutation({
    mutationFn: updateCrmStatus,
    onMutate: ({ pipelineId }) => {
      setStatusUpdatingId(pipelineId);
    },
    onSuccess: (_, variables) => {
      toast.success(`Estado actualizado a ${getCrmStatusLabel(variables.status)}`);
      queryClient.invalidateQueries({ queryKey: ['crmGrants'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado');
    },
    onSettled: () => {
      setStatusUpdatingId(null);
    },
  });

  const deleteGrantMutation = useMutation({
    mutationFn: deleteCrmGrant,
    onMutate: (pipelineId) => {
      setDeletingPipelineId(pipelineId);
    },
    onSuccess: () => {
      toast.success('Subvención eliminada del CRM');
      setPendingDeleteGrant(null);
      queryClient.invalidateQueries({ queryKey: ['crmGrants'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la subvención');
    },
    onSettled: () => {
      setDeletingPipelineId(null);
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: uploadCorporateDocument,
    onMutate: ({ documentTypeCode }) => {
      setUploadingDocumentCode(documentTypeCode);
    },
    onSuccess: (_, variables) => {
      toast.success('Documento subido correctamente', {
        description: `Se ha actualizado ${variables.documentTypeCode.replace(/_/g, ' ')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['crmCorporateDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['entityDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['entityCorporateDocuments'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el documento');
    },
    onSettled: () => {
      setUploadingDocumentCode(null);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: deleteCorporateDocument,
    onMutate: (documentId) => {
      setDeletingDocumentId(documentId);
    },
    onSuccess: (_, documentId) => {
      toast.success('Documento eliminado');
      setPendingDeleteDocument(null);
      queryClient.invalidateQueries({ queryKey: ['crmCorporateDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['entityDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['entityCorporateDocuments'] });
    },
    onError: (error, documentId) => {
      console.error('Error deleting CRM document', { documentId, error });
      toast.error('No se pudo eliminar el documento');
    },
    onSettled: () => {
      setDeletingDocumentId(null);
    },
  });

  const calendarEvents = useMemo(() => {
    const eventMap = new Map<string, CalendarEvent[]>();
    const startEventsByDay = new Map<string, CalendarEvent[]>();
    const deadlineEventsByDay = new Map<string, CalendarEvent[]>();
    const allEvents: CalendarEvent[] = [];

    grants.forEach((grant) => {
      const startDate = parseBackendDate(grant.fecha_inicio);
      if (startDate) {
        const key = format(startDate, 'yyyy-MM-dd');
        const event: CalendarEvent = {
          id: `${grant.id}-start`,
          grantId: grant.grant_id,
          title: grant.titulo_corto,
          type: 'start',
          date: startDate,
          dateLabel: grant.fecha_inicio_display,
        };
        eventMap.set(key, [...(eventMap.get(key) || []), event]);
        startEventsByDay.set(key, [...(startEventsByDay.get(key) || []), event]);
        allEvents.push(event);
      }

      const deadlineDate = parseBackendDate(grant.fecha_limite);
      if (deadlineDate) {
        const key = format(deadlineDate, 'yyyy-MM-dd');
        const event: CalendarEvent = {
          id: `${grant.id}-deadline`,
          grantId: grant.grant_id,
          title: grant.titulo_corto,
          type: 'deadline',
          date: deadlineDate,
          dateLabel: grant.fecha_limite_display,
        };
        eventMap.set(key, [...(eventMap.get(key) || []), event]);
        deadlineEventsByDay.set(key, [...(deadlineEventsByDay.get(key) || []), event]);
        allEvents.push(event);
      }
    });

    const startOnlyDates: Date[] = [];
    const deadlineOnlyDates: Date[] = [];
    const mixedDates: Date[] = [];

    for (const [key, dayEvents] of eventMap.entries()) {
      const hasStart = dayEvents.some((event) => event.type === 'start');
      const hasDeadline = dayEvents.some((event) => event.type === 'deadline');
      const date = parseISO(key);
      if (!isValid(date)) continue;

      if (hasStart && hasDeadline) {
        mixedDates.push(date);
      } else if (hasStart) {
        startOnlyDates.push(date);
      } else if (hasDeadline) {
        deadlineOnlyDates.push(date);
      }
    }

    allEvents.sort((left, right) => left.date.getTime() - right.date.getTime());

    return {
      eventMap,
      allEvents,
      startEventsByDay,
      deadlineEventsByDay,
      startOnlyDates,
      deadlineOnlyDates,
      mixedDates,
    };
  }, [grants]);

  const grantHistory = useMemo(() => {
    return [...grants].sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
      return rightTime - leftTime;
    });
  }, [grants]);

  const nearDeadlineCount = useMemo(
    () => grants.filter((grant) => getDeadlineStatus(grant.fecha_limite_display) === 'warning').length,
    [grants],
  );

  const submittedOrBeyondCount = useMemo(
    () =>
      grants.filter((grant) =>
        ['presentada', 'requerimiento', 'subsanado', 'concedida', 'denegada', 'justificacion', 'terminada'].includes(grant.status),
      ).length,
    [grants],
  );

  const corporateDocumentsProgress = corporateDocumentsData?.total_required
    ? Math.round(((corporateDocumentsData.uploaded_count || 0) / corporateDocumentsData.total_required) * 100)
    : 0;
  const hasExportableDocuments = (corporateDocumentsData?.total_current_documents || 0) > 0;

  const handleCalendarDeadlineClick = (
    event: React.MouseEvent<HTMLButtonElement | HTMLDivElement>,
    grantId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(`/grants/${grantId}`);
  };

  const renderCalendarDay = ({ date, activeModifiers }: DayContentProps) => {
    const key = format(date, 'yyyy-MM-dd');
    const deadlineEvents = calendarEvents.deadlineEventsByDay.get(key) || [];
    const startEvents = calendarEvents.startEventsByDay.get(key) || [];
    const visibleDeadlineEvents = deadlineEvents.slice(0, 2);
    const remainingDeadlines = Math.max(0, deadlineEvents.length - visibleDeadlineEvents.length);

    return (
      <div
        className={cn(
          'flex h-full w-full flex-col gap-1 p-2 text-left',
          deadlineEvents.length > 0 && 'cursor-pointer',
          activeModifiers.outside && 'opacity-55',
        )}
        onClick={
          deadlineEvents.length === 1
            ? (event) => handleCalendarDeadlineClick(event, deadlineEvents[0].grantId)
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-xs font-semibold', activeModifiers.today ? 'text-primary' : 'text-foreground')}>
            {date.getDate()}
          </span>
          {startEvents.length > 0 ? (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              Inicio
            </span>
          ) : null}
        </div>

        <div className="space-y-1 overflow-hidden">
          {visibleDeadlineEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={(clickEvent) => handleCalendarDeadlineClick(clickEvent, event.grantId)}
              className="w-full cursor-pointer rounded-md bg-yellow-200/90 px-1.5 py-1 text-left text-[10px] font-medium leading-tight text-yellow-950 transition-none hover:bg-yellow-200/90 focus:bg-yellow-200/90 active:bg-yellow-200/90"
              title={`${event.title} · Cierra el ${event.dateLabel}`}
            >
              <div className="line-clamp-3">{event.title}</div>
            </button>
          ))}

          {remainingDeadlines > 0 ? (
            <div className="text-[10px] font-medium text-muted-foreground">
              +{remainingDeadlines} subvención{remainingDeadlines > 1 ? 'es' : ''} más
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const handleStatusChange = (pipelineId: number, status: string) => {
    updateStatusMutation.mutate({ pipelineId, status });
  };

  const handleDeleteGrant = (pipelineId: number, title: string) => {
    setPendingDeleteGrant({ id: pipelineId, title });
  };

  const handleDeleteDocument = (document: CorporateDocumentRecord, slotLabel: string) => {
    setPendingDeleteDocument({
      id: document.id,
      filename: document.filename,
      slotLabel,
    });
  };

  const handleConfirmDeleteGrant = () => {
    if (!pendingDeleteGrant) return;
    deleteGrantMutation.mutate(pendingDeleteGrant.id);
  };

  const handleConfirmDeleteDocument = () => {
    if (!pendingDeleteDocument) return;
    deleteDocumentMutation.mutate(pendingDeleteDocument.id);
  };

  const handleCorporateDocumentUpload = (
    documentTypeCode: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    uploadDocumentMutation.mutate({
      documentTypeCode,
      file,
    });
  };

  const handleCorporateDocumentDownload = async (documentId: number) => {
    try {
      setDownloadingDocumentId(documentId);
      await downloadCorporateDocument(documentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo descargar el documento');
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const handleCorporateDocumentsExport = async () => {
    try {
      setIsExportingDocuments(true);
      await exportCorporateDocumentsZip();
    } catch (error) {
      console.error('Error exporting CRM documents ZIP', error);
      toast.error('Error al exportar');
    } finally {
      setIsExportingDocuments(false);
    }
  };

  const isLoading = isLoadingCrm || isLoadingDocuments;
  const hasError = crmError || documentsError;

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background md:pl-20">
        <div className="container mx-auto px-3 sm:px-4 pt-20 pb-24 md:pb-8">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    const message = crmError instanceof Error
      ? crmError.message
      : documentsError instanceof Error
        ? documentsError.message
        : 'No se pudo cargar el CRM';

    return (
      <div className="flex flex-col min-h-screen bg-background md:pl-20">
        <div className="container mx-auto px-3 sm:px-4 pt-20 pb-24 md:pb-8">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                No se pudo cargar el CRM
              </CardTitle>
              <CardDescription>{message}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button onClick={() => { void refetchCrm(); void refetchDocuments(); }}>
                Reintentar
              </Button>
              <Button variant="outline" onClick={() => navigate('/entities')}>
                Ir a Mi Entidad
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col min-h-screen bg-background md:pl-20">
        <div className="container mx-auto px-3 sm:px-4 pt-20 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto space-y-5 sm:space-y-8">
          <div className="space-y-3">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Gestiona las ayudas que quieres tramitar</h1>
              <p className="max-w-3xl text-sm sm:text-base text-muted-foreground">
                Añade una ayuda desde su detalle con el botón <strong>Añadir al CRM</strong> y después
                síguela aquí con su estado, calendario de hitos y documentación corporativa clave.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border-primary/15">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Subvenciones en seguimiento</p>
                  <p className="text-xs text-muted-foreground">
                    Ayudas que ya has decidido mover desde el detalle.
                  </p>
                </div>
                <div className="shrink-0 text-2xl font-bold text-foreground">{grants.length}</div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Documentación completada</p>
                    <p className="text-xs text-muted-foreground">
                      Vault corporativo listo para acelerar la tramitación.
                    </p>
                  </div>
                  <div className="shrink-0 text-2xl font-bold text-foreground">
                    {corporateDocumentsData?.uploaded_count || 0}/{corporateDocumentsData?.total_required || 0}
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${corporateDocumentsProgress}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="pipeline" className="w-full">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="pipeline" className="text-xs sm:text-sm">Subvenciones</TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs sm:text-sm">Calendario</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs sm:text-sm">Documentación</TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline" className="pt-4 sm:pt-6">
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg">Pipeline de tramitación</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Haz clic en una ayuda para abrir su detalle y actualiza el estado cuando avances en el expediente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {grants.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                      <KanbanSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="font-medium">Todavía no tienes subvenciones en el CRM</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Cuando una ayuda te interese de verdad, entra en su detalle y añádela al CRM para gestionarla aquí.
                      </p>
                      <Button className="mt-4" onClick={() => navigate('/subvenciones')}>
                        Explorar subvenciones
                      </Button>
                    </div>
                  ) : (
                    <>
                    {/* Mobile card view */}
                    <div className="space-y-3 md:hidden">
                      {grants.map((grant) => {
                        const deadlineStatus = getDeadlineStatus(grant.fecha_limite_display);
                        const deadlineStyles = getDeadlineStyles(deadlineStatus);

                        return (
                          <div
                            key={`mobile-${grant.id}`}
                            className="rounded-xl border bg-background p-4 space-y-3 cursor-pointer active:bg-muted/30 transition-colors"
                            onClick={() => navigate(`/grants/${grant.grant_id}`)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">
                                {grant.titulo_corto}
                              </h3>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 -mt-1 -mr-2 h-8 w-8"
                                disabled={deletingPipelineId === grant.id}
                                onClick={(e) => { e.stopPropagation(); handleDeleteGrant(grant.id, grant.titulo_corto); }}
                                aria-label={`Eliminar ${grant.titulo_corto} del CRM`}
                              >
                                {deletingPipelineId === grant.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn('border text-xs', getCrmStatusBadgeClass(grant.status))}
                              >
                                {getCrmStatusLabel(grant.status)}
                              </Badge>
                              <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${deadlineStyles.bgColor}`}>
                                {getDeadlineIcon(deadlineStatus, `h-3 w-3 ${deadlineStyles.textColor}`)}
                                <span className={deadlineStyles.textColor}>{grant.fecha_limite_display}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                              <div>
                                <span className="font-medium text-foreground">Beneficiario:</span>{' '}
                                {grant.importe_beneficiario}
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Región:</span>{' '}
                                {grant.region}
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Fondos:</span>{' '}
                                {grant.fondos_totales}
                              </div>
                              <div className="col-span-2">
                                <span className="font-medium text-foreground">Finalidad:</span>{' '}
                                <span className="line-clamp-1">{grant.finalidad}</span>
                              </div>
                            </div>

                            <div onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={grant.status}
                                onValueChange={(value) => handleStatusChange(grant.id, value)}
                                disabled={statusUpdatingId === grant.id}
                              >
                                <SelectTrigger className="w-full cursor-pointer text-xs h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CRM_PIPELINE_STATUSES.map((status) => (
                                    <SelectItem className="cursor-pointer" key={status.value} value={status.value}>
                                      {status.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
                    <Table className="min-w-[1120px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título corto subvención</TableHead>
                          <TableHead>Plazo</TableHead>
                          <TableHead>Cuánto recibe el beneficiario</TableHead>
                          <TableHead>Región</TableHead>
                          <TableHead>Fondos total</TableHead>
                          <TableHead>Finalidad</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-[64px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grants.map((grant) => {
                          const deadlineStatus = getDeadlineStatus(grant.fecha_limite_display);
                          const deadlineStyles = getDeadlineStyles(deadlineStatus);

                          return (
                            <TableRow
                              key={grant.id}
                              className="cursor-pointer"
                              onClick={() => navigate(`/grants/${grant.grant_id}`)}
                            >
                              <TableCell className="font-medium text-foreground">
                                <div className="space-y-1">
                                  <div>{grant.titulo_corto}</div>
                                  <Badge
                                    variant="outline"
                                    className={cn('w-fit border', getCrmStatusBadgeClass(grant.status))}
                                  >
                                    {getCrmStatusLabel(grant.status)}
                                  </Badge>
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${deadlineStyles.bgColor}`}>
                                  {getDeadlineIcon(deadlineStatus, `h-3.5 w-3.5 ${deadlineStyles.textColor}`)}
                                  <span className={deadlineStyles.textColor}>{grant.fecha_limite_display}</span>
                                </div>
                              </TableCell>

                              <TableCell>{grant.importe_beneficiario}</TableCell>
                              <TableCell>{grant.region}</TableCell>
                              <TableCell>{grant.fondos_totales}</TableCell>
                              <TableCell className="max-w-[280px] truncate" title={grant.finalidad}>
                                {grant.finalidad}
                              </TableCell>

                              <TableCell onClick={(event) => event.stopPropagation()}>
                                <Select
                                  value={grant.status}
                                  onValueChange={(value) => handleStatusChange(grant.id, value)}
                                  disabled={statusUpdatingId === grant.id}
                                >
                                  <SelectTrigger className="w-[220px] cursor-pointer">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CRM_PIPELINE_STATUSES.map((status) => (
                                      <SelectItem className="cursor-pointer" key={status.value} value={status.value}>
                                        {status.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              <TableCell onClick={(event) => event.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={deletingPipelineId === grant.id}
                                  onClick={() => handleDeleteGrant(grant.id, grant.titulo_corto)}
                                  aria-label={`Eliminar ${grant.titulo_corto} del CRM`}
                                >
                                  {deletingPipelineId === grant.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calendar" className="pt-4 sm:pt-6">
              <div className="space-y-4 sm:space-y-6">
                <Card>
                  <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="text-base sm:text-lg">Calendario mensual</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Vista completa del mes con los cierres de plazo integrados dentro de cada día para que puedas planificar mejor las tramitaciones.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
                    <div className="min-w-[700px]">
                    <Calendar
                      showOutsideDays
                      modifiers={{
                        startOnly: calendarEvents.startOnlyDates,
                        deadlineOnly: calendarEvents.deadlineOnlyDates,
                        mixed: calendarEvents.mixedDates,
                      }}
                      modifiersClassNames={{
                        startOnly: 'border-blue-200 bg-blue-50/60 hover:bg-blue-50/60',
                        deadlineOnly: 'border-yellow-300 bg-yellow-50/80 hover:bg-yellow-50/80',
                        mixed: 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50/60',
                      }}
                      modifiersStyles={{
                        startOnly: {
                          backgroundColor: 'rgb(239 246 255 / 0.6)',
                          borderColor: 'rgb(191 219 254)',
                        },
                        deadlineOnly: {
                          backgroundColor: 'rgb(254 249 195 / 0.8)',
                          borderColor: 'rgb(253 224 71)',
                          cursor: 'pointer',
                        },
                        mixed: {
                          backgroundColor: 'rgb(236 253 245 / 0.6)',
                          borderColor: 'rgb(110 231 183)',
                          cursor: 'pointer',
                        },
                      }}
                      components={{
                        DayContent: renderCalendarDay,
                      }}
                      className="rounded-xl border bg-card p-3"
                      classNames={{
                        months: 'flex flex-col',
                        month: 'w-full space-y-4',
                        caption: 'flex items-center justify-center pt-2 relative',
                        caption_label: 'text-base font-semibold',
                        nav_button: 'h-8 w-8 rounded-md border bg-background p-0 opacity-100 hover:bg-muted',
                        table: 'w-full border-separate border-spacing-2',
                        head_row: 'grid grid-cols-7 gap-2',
                        head_cell: 'rounded-lg border bg-muted/40 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                        row: 'grid grid-cols-7 gap-2 mt-0',
                        cell: 'h-[100px] overflow-hidden rounded-xl border border-border/70 bg-background p-0 align-top sm:h-[120px] md:h-[140px] xl:h-[150px]',
                        day: 'h-full w-full items-start justify-start rounded-xl p-0 text-left font-normal hover:bg-transparent focus:bg-transparent active:bg-transparent hover:text-inherit focus:text-inherit active:text-inherit',
                        day_today: 'ring-2 ring-primary/25',
                        day_outside: 'bg-muted/20 text-muted-foreground opacity-60',
                      }}
                    />
                    </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        Inicio de solicitud
                      </Badge>
                      <Badge variant="outline" className="border-yellow-300 bg-yellow-100 text-yellow-900">
                        Cierre de plazo
                      </Badge>

                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="text-base sm:text-lg">Historial de Subvenciones</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Resumen de las ayudas en CRM con su estado actual, fechas clave y último movimiento registrado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {grantHistory.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        Aún no hay subvenciones en el CRM para mostrar historial.
                      </div>
                    ) : (
                      <>
                      {/* Mobile card view */}
                      <div className="space-y-3 md:hidden">
                        {grantHistory.map((grant) => (
                          <div
                            key={`history-mobile-${grant.id}`}
                            className="rounded-xl border bg-background p-4 space-y-2 cursor-pointer active:bg-muted/30 transition-colors"
                            onClick={() => navigate(`/grants/${grant.grant_id}`)}
                          >
                            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                              {grant.titulo_corto}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn('border text-xs', getCrmStatusBadgeClass(grant.status))}
                              >
                                {getCrmStatusLabel(grant.status)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <div>
                                <span className="font-medium text-foreground">Inicio:</span>{' '}
                                {grant.fecha_inicio_display}
                              </div>
                              <div>
                                <span className="font-medium text-foreground">Cierre:</span>{' '}
                                {grant.fecha_limite_display}
                              </div>
                              <div className="col-span-2">
                                <span className="font-medium text-foreground">Último mov.:</span>{' '}
                                {grant.updated_at
                                  ? new Date(grant.updated_at).toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })
                                  : 'Sin movimiento'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table view */}
                      <div className="hidden md:block overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6">
                      <Table className="min-w-[920px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subvención</TableHead>
                            <TableHead>Estado actual</TableHead>
                            <TableHead>Inicio</TableHead>
                            <TableHead>Cierre</TableHead>
                            <TableHead>Último movimiento</TableHead>
                            <TableHead className="w-[90px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grantHistory.map((grant) => (
                            <TableRow
                              key={`history-${grant.id}`}
                              className="cursor-pointer"
                              onClick={() => navigate(`/grants/${grant.grant_id}`)}
                            >
                              <TableCell className="font-medium text-foreground">
                                <div className="max-w-[320px] truncate" title={grant.titulo_corto}>
                                  {grant.titulo_corto}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn('border', getCrmStatusBadgeClass(grant.status))}
                                >
                                  {getCrmStatusLabel(grant.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>{grant.fecha_inicio_display}</TableCell>
                              <TableCell>{grant.fecha_limite_display}</TableCell>
                              <TableCell>
                                {grant.updated_at
                                  ? new Date(grant.updated_at).toLocaleDateString('es-ES', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })
                                  : 'Sin movimiento'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(`/grants/${grant.grant_id}`);
                                  }}
                                >
                                  Ver
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="pt-4 sm:pt-6">
              <Card>
                <CardHeader className="px-4 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base sm:text-lg">Vault documental reutilizable</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Guarda aquí la documentación corporativa que más se repite en las convocatorias para no empezar de cero cada vez.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={!hasExportableDocuments || isExportingDocuments}
                      onClick={() => void handleCorporateDocumentsExport()}
                    >
                      {isExportingDocuments ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Exportar .zip
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {corporateDocuments.map((item) => {
                      const uploadedDocument = item.document;
                      const isUploading = uploadingDocumentCode === item.document_type_code;
                      const isDownloading = downloadingDocumentId === uploadedDocument?.id;
                      const isDeleting = deletingDocumentId === uploadedDocument?.id;

                      return (
                        <div
                          key={item.document_type_code}
                          className="group flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm"
                        >
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{item.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.description || 'Documento corporativo habitual en convocatorias.'}
                              </p>
                            </div>
                            <div className="relative flex h-8 min-w-[92px] items-start justify-end">
                              {uploadedDocument ? (
                                <>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'pointer-events-none absolute right-0 top-0 transition-opacity',
                                      isDeleting ? 'opacity-0' : 'group-hover:opacity-0',
                                      'border-emerald-200 bg-emerald-50 text-emerald-700',
                                    )}
                                  >
                                    Subido
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      'absolute right-0 top-0 h-8 w-8 text-destructive transition-opacity',
                                      isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                                    )}
                                    disabled={isDeleting}
                                    onClick={() => handleDeleteDocument(uploadedDocument, item.label)}
                                    aria-label={`Eliminar documento de ${item.label}`}
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-amber-200 bg-amber-50 text-amber-800"
                                >
                                  Pendiente
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 rounded-lg border border-dashed bg-muted/20 p-3">
                            {uploadedDocument ? (
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <FileText className="mt-0.5 h-4 w-4 text-primary" />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground" title={uploadedDocument.filename}>
                                      {uploadedDocument.filename}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {uploadedDocument.upload_date
                                        ? new Date(uploadedDocument.upload_date).toLocaleDateString('es-ES', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                          })
                                        : 'Sin fecha'}
                                      {' · '}
                                      {formatCompactFileSize(uploadedDocument.file_size)}
                                    </p>
                                  </div>
                                </div>
                                <div className="inline-flex items-center gap-1 text-xs text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Documento vigente
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">Aún no lo has subido</p>
                                <p className="text-xs text-muted-foreground">
                                  Súbelo una vez y quedará disponible como base para futuras tramitaciones.
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex gap-2">
                            <input
                              id={`corporate-document-${item.document_type_code}`}
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                              onChange={(event) => handleCorporateDocumentUpload(item.document_type_code, event)}
                            />
                            <Button
                              type="button"
                              className="flex-1"
                              variant="outline"
                              disabled={isUploading}
                              onClick={() => {
                                const input = document.getElementById(
                                  `corporate-document-${item.document_type_code}`,
                                ) as HTMLInputElement | null;
                                input?.click();
                              }}
                            >
                              {isUploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              {uploadedDocument ? 'Reemplazar' : 'Subir'}
                            </Button>

                            {uploadedDocument?.id ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isDownloading}
                                onClick={() => handleCorporateDocumentDownload(uploadedDocument.id)}
                                aria-label={`Descargar ${item.label}`}
                              >
                                {isDownloading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    {extraDocuments.map((document) => {
                      const isDownloading = downloadingDocumentId === document.id;
                      const isDeleting = deletingDocumentId === document.id;

                      return (
                        <div
                          key={`extra-${document.id}`}
                          className="group flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm"
                        >
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className="truncate font-medium text-foreground"
                                title={document.filename}
                              >
                                {document.filename}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Archivo adicional que Granti puede usar para entender mejor tu entidad.
                              </p>
                            </div>
                            <div className="relative flex h-8 min-w-[76px] items-start justify-end">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'pointer-events-none absolute right-0 top-0 border-sky-200 bg-sky-50 text-sky-700 transition-opacity',
                                  isDeleting ? 'opacity-0' : 'group-hover:opacity-0',
                                )}
                              >
                                Extra
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'absolute right-0 top-0 h-8 w-8 text-destructive transition-opacity',
                                  isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                                )}
                                disabled={isDeleting}
                                onClick={() => handleDeleteDocument(document, 'Documentación extra')}
                                aria-label={`Eliminar ${document.filename}`}
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="flex-1 rounded-lg border border-dashed bg-muted/20 p-3">
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <FileText className="mt-0.5 h-4 w-4 text-primary" />
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-sm font-medium text-foreground"
                                    title={document.filename}
                                  >
                                    {document.filename}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {document.upload_date
                                      ? new Date(document.upload_date).toLocaleDateString('es-ES', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                        })
                                      : 'Sin fecha'}
                                    {' · '}
                                    {formatCompactFileSize(document.file_size)}
                                  </p>
                                </div>
                              </div>
                              <div className="inline-flex items-center gap-1 text-xs text-sky-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Contexto adicional para Granti
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <Button
                              variant="outline"
                              className="w-full"
                              disabled={isDownloading}
                              onClick={() => void handleCorporateDocumentDownload(document.id)}
                            >
                              {isDownloading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              Descargar
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex h-full flex-col rounded-xl border border-dashed bg-muted/20 p-4 shadow-sm">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">Documentación extra</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Adjunta aquí cualquier archivo adicional que quieras tener a mano para futuras solicitudes.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            extraDocuments.length > 0
                              ? 'border-sky-200 bg-sky-50 text-sky-700'
                              : 'border-muted-foreground/20 bg-background text-muted-foreground'
                          }
                        >
                          Opcional
                        </Badge>
                      </div>

                      <div className="flex-1 space-y-4">
                        <input
                          id="corporate-document-extra"
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                          onChange={(event) => handleCorporateDocumentUpload(EXTRA_DOCUMENT_TYPE_CODE, event)}
                        />

                        <button
                          type="button"
                          className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-5 text-center transition-colors hover:bg-muted/40"
                          onClick={() => {
                            const input = document.getElementById('corporate-document-extra') as HTMLInputElement | null;
                            input?.click();
                          }}
                          disabled={uploadingDocumentCode === EXTRA_DOCUMENT_TYPE_CODE}
                        >
                          {uploadingDocumentCode === EXTRA_DOCUMENT_TYPE_CODE ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : (
                            <Plus className="h-5 w-5 text-primary" />
                          )}
                          <span className="mt-2 text-sm font-medium text-foreground">
                            Adjuntar documentación extra
                          </span>
                          <span className="mt-1 text-xs text-muted-foreground">
                            Cada archivo extra aparecerá como una casilla propia dentro del vault.
                          </span>
                        </button>

                        {extraDocuments.length === 0 ? (
                          <div className="rounded-lg border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">
                            Todavía no has añadido documentación extra.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingDeleteGrant !== null}
        onOpenChange={(open) => {
          if (!open && deletingPipelineId === null) {
            setPendingDeleteGrant(null);
          }
        }}
      >
        <AlertDialogContent
          className="sm:max-w-md"
          onPointerDownOutside={() => {
            if (deletingDocumentId === null) {
              setPendingDeleteDocument(null);
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar subvención del CRM?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteGrant
                ? `¿Seguro que quieres eliminar "${pendingDeleteGrant.title}" de tu CRM? Podrás volver a añadirla desde el detalle de la subvención cuando quieras.`
                : '¿Seguro que quieres eliminar esta subvención de tu CRM?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={deletingPipelineId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteGrant}
            >
              {deletingPipelineId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Sí, eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteDocument !== null}
        onOpenChange={(open) => {
          if (!open && deletingDocumentId === null) {
            setPendingDeleteDocument(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteDocument
                ? `Se eliminará el archivo adjuntado de "${pendingDeleteDocument.slotLabel}". Si lo borras, Granti tendrá menos contexto documental sobre tu entidad y no podrá afinar las recomendaciones.`
                : 'Si eliminas este documento, Granti tendrá menos contexto documental sobre tu entidad y no podrá afinar las recomendaciones.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={deletingDocumentId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteDocument}
            >
              {deletingDocumentId !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Sí, eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Crm;
