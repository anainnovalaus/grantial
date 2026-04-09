import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  File,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchWithTimeout } from '@/lib/api';
import { formatCompactFileSize } from '@/lib/crm';
import { cn } from '@/lib/utils';

interface EntityDocument {
  id: number;
  filename: string;
  s3_key: string;
  s3_bucket: string;
  file_size: number;
  upload_date: string;
  status: string;
  document_type_code?: string | null;
  document_type_label?: string | null;
  mime_type?: string | null;
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

interface EntityDocumentsProps {
  entityId: string;
}

interface PendingDeleteDocument {
  id: number;
  filename: string;
  slotLabel: string;
}

const apiUrl = import.meta.env.VITE_API_URL;
const EXTRA_DOCUMENT_TYPE_CODE = 'documentacion_extra';
const EXPORT_TIMEOUT_MS = 300000;

const fetchEntityDocuments = async (entityId: string): Promise<EntityDocument[]> => {
  const accessToken = localStorage.getItem('accessToken');
  const response = await fetch(`${apiUrl}/api/get_entity_documents/${entityId}`, {
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || payload?.message || `Error al obtener documentos: ${response.status}`);
  }

  const data = await response.json();
  return data.documents || [];
};

const fetchCorporateDocuments = async (entityId: string): Promise<CorporateDocumentsResponse> => {
  const accessToken = localStorage.getItem('accessToken');
  const response = await fetch(
    `${apiUrl}/api/crm/corporate-documents?entity_id=${encodeURIComponent(entityId)}`,
    {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo cargar la documentación corporativa (${response.status})`);
  }

  return payload as CorporateDocumentsResponse;
};

const uploadCorporateDocument = async ({
  entityId,
  documentTypeCode,
  file,
}: {
  entityId: string;
  documentTypeCode: string;
  file: File;
}) => {
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Debes iniciar sesión para subir documentos');
  }

  const formData = new FormData();
  formData.append('entity_id', entityId);
  formData.append('document_type_code', documentTypeCode);
  formData.append('file', file);

  const response = await fetch(`${apiUrl}/api/crm/corporate-documents/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo subir el documento (${response.status})`);
  }

  return payload;
};

const deleteCorporateDocument = async (documentId: number) => {
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) {
    throw new Error('Debes iniciar sesión para eliminar documentos');
  }

  const response = await fetch(`${apiUrl}/api/crm/corporate-documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `No se pudo eliminar el documento (${response.status})`);
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
  const accessToken = localStorage.getItem('accessToken');
  const response = await fetch(`${apiUrl}/api/crm/corporate-documents/${documentId}/download`, {
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `No se pudo descargar el documento (${response.status})`);
  }

  const blob = await response.blob();
  const filename = getResponseFilename(response, `documento_${documentId}`);
  triggerBlobDownload(blob, filename);
};

const exportCorporateDocumentsZip = async (entityId: string) => {
  const accessToken = localStorage.getItem('accessToken');
  const query = new URLSearchParams({ entity_id: entityId }).toString();
  const response = await fetchWithTimeout(
    `${apiUrl}/api/crm/corporate-documents/export?${query}`,
    {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/zip',
          }
        : undefined,
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

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="border-green-500/20 bg-green-500/10 text-green-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Procesado
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" className="border-amber-500/20 bg-amber-500/10 text-amber-600">
          <Clock className="mr-1 h-3 w-3 animate-spin" />
          Procesando
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-600">
          <AlertCircle className="mr-1 h-3 w-3" />
          Error
        </Badge>
      );
    case 'uploaded':
      return (
        <Badge variant="outline">
          <File className="mr-1 h-3 w-3" />
          Subido
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const EntityDocuments: React.FC<EntityDocumentsProps> = ({ entityId }) => {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedDocumentCode, setSelectedDocumentCode] = useState<string | null>(null);
  const [uploadingDocumentCode, setUploadingDocumentCode] = useState<string | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const [isExportingDocuments, setIsExportingDocuments] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  const [pendingDeleteDocument, setPendingDeleteDocument] = useState<PendingDeleteDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const {
    data: documents,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['entityDocuments', entityId],
    queryFn: () => fetchEntityDocuments(entityId),
    enabled: !!entityId,
    refetchInterval: 10000,
  });

  const {
    data: corporateDocumentsData,
    error: corporateDocumentsError,
  } = useQuery({
    queryKey: ['entityCorporateDocuments', entityId],
    queryFn: () => fetchCorporateDocuments(entityId),
    enabled: !!entityId,
  });

  const corporateDocuments = useMemo(
    () => corporateDocumentsData?.items ?? [],
    [corporateDocumentsData?.items],
  );
  const extraDocuments = useMemo(
    () => corporateDocumentsData?.extra_documents ?? [],
    [corporateDocumentsData?.extra_documents],
  );

  const nextSuggestedDocument = useMemo(
    () => corporateDocuments.find((item) => !item.has_file) ?? null,
    [corporateDocuments],
  );
  const hasDocumentsOverflow = (documents?.length ?? 0) > 3;
  const hasExportableDocuments = (documents?.length ?? 0) > 0;

  const uploadDocumentMutation = useMutation({
    mutationFn: uploadCorporateDocument,
    onSuccess: (_, variables) => {
      toast.success('Documento subido correctamente', {
        description: `Se ha actualizado ${variables.documentTypeCode.replace(/_/g, ' ')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['entityDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['entityCorporateDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['crmCorporateDocuments'] });
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : 'No se pudo subir el documento');
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: deleteCorporateDocument,
    onMutate: (documentId) => {
      setDeletingDocumentId(documentId);
    },
    onSuccess: () => {
      toast.success('Documento eliminado');
      setPendingDeleteDocument(null);
      queryClient.invalidateQueries({ queryKey: ['entityDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['entityCorporateDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['crmCorporateDocuments'] });
    },
    onError: (mutationError, documentId) => {
      console.error('Error deleting entity document', { documentId, mutationError });
      toast.error('No se pudo eliminar el documento');
    },
    onSettled: () => {
      setDeletingDocumentId(null);
    },
  });

  const openNativePicker = (documentTypeCode: string) => {
    if (uploadDocumentMutation.isPending) return;
    setSelectedDocumentCode(documentTypeCode);
    fileInputRef.current?.click();
  };

  const handleCatalogFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = event.target.files?.[0];
    const documentTypeCode = selectedDocumentCode;

    if (!file || !documentTypeCode) {
      input.value = '';
      setSelectedDocumentCode(null);
      return;
    }

    setUploadingDocumentCode(documentTypeCode);
    uploadDocumentMutation.mutate(
      {
        entityId,
        documentTypeCode,
        file,
      },
      {
        onSettled: () => {
          setUploadingDocumentCode(null);
          setSelectedDocumentCode(null);
          input.value = '';
        },
      },
    );
  };

  const handleDocumentDownload = async (documentId: number) => {
    try {
      setDownloadingDocumentId(documentId);
      await downloadCorporateDocument(documentId);
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : 'No se pudo descargar el documento');
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const handleDocumentsExport = async () => {
    try {
      setIsExportingDocuments(true);
      await exportCorporateDocumentsZip(entityId);
    } catch (exportError) {
      console.error('Error exporting entity documents ZIP', { entityId, exportError });
      toast.error('Error al exportar');
    } finally {
      setIsExportingDocuments(false);
    }
  };

  const handleDeleteDocument = (document: { id: number; filename: string }, slotLabel: string) => {
    setPendingDeleteDocument({
      id: document.id,
      filename: document.filename,
      slotLabel,
    });
  };

  const handleConfirmDeleteDocument = () => {
    if (!pendingDeleteDocument) return;
    deleteDocumentMutation.mutate(pendingDeleteDocument.id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'No se pudieron cargar los documentos'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-5 w-5 shrink-0" />
                Documentos de la entidad
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Aquí ves todo lo que ya has centralizado para que Granti entienda mejor tu entidad y prepare convocatorias con más contexto.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto shrink-0"
                disabled={!hasExportableDocuments || isExportingDocuments}
                onClick={() => void handleDocumentsExport()}
              >
                {isExportingDocuments ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar .zip
              </Button>
              <Button size="sm" className="w-full sm:w-auto shrink-0" onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Subir documento
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {nextSuggestedDocument ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-sky-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-sky-900">
                    Sugerencia: sube {nextSuggestedDocument.label}
                  </p>
                  <p className="mt-1 text-xs text-sky-800">
                    Añadir este documento ayuda a Granti a tener más contexto de tu entidad y afinar mejor las subvenciones que te propone.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-sky-200 bg-white text-sky-800 hover:bg-sky-100"
                  onClick={() => setIsUploadDialogOpen(true)}
                >
                  Ver opciones
                </Button>
              </div>
            </div>
          ) : corporateDocumentsData ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">
                    Tu documentación principal ya está preparada
                  </p>
                  <p className="mt-1 text-xs text-emerald-800">
                    Ya no quedan documentos sugeridos en el vault documental.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {documents && documents.length > 0 ? (
            <div
              className={[
                'space-y-3',
                hasDocumentsOverflow ? 'max-h-[252px] overflow-y-auto pr-1' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {documents.map((doc) => {
                const isDeleting = deletingDocumentId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className="group flex items-center justify-between rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="shrink-0 rounded-lg bg-primary/10 p-2">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium" title={doc.filename}>
                            {doc.filename}
                          </p>
                          {doc.document_type_label ? (
                            <Badge variant="secondary" className="text-[11px]">
                              {doc.document_type_label}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatCompactFileSize(doc.file_size)}</span>
                          <span>•</span>
                          <span>{formatDate(doc.upload_date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-2 shrink-0">
                      <div className="relative flex h-8 min-w-[92px] items-center justify-end">
                        <div
                          className={cn(
                            'absolute right-0 transition-opacity',
                            isDeleting ? 'opacity-0' : 'group-hover:opacity-0',
                          )}
                        >
                          {getStatusBadge(doc.status)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute right-0 h-8 w-8 text-destructive transition-opacity',
                            isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                          )}
                          disabled={isDeleting}
                          onClick={() => handleDeleteDocument(doc, doc.document_type_label || 'Documento')}
                          aria-label={`Eliminar ${doc.filename}`}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="font-medium">Todavía no has centralizado documentación</p>
              <p className="mt-1 text-sm">
                Empieza por el Pick deck o por cualquier documento corporativo clave para que Granti tenga más contexto.
              </p>
            </div>
          )}

          {corporateDocumentsError ? (
            <p className="text-xs text-muted-foreground">
              No se pudo cargar la sugerencia documental ahora mismo, pero la lista principal sí está disponible.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden p-0 max-w-[calc(100vw-2rem)] sm:max-w-4xl">
          <div className="border-b p-6">
            <DialogHeader>
              <DialogTitle>Subir documentación corporativa</DialogTitle>
              <DialogDescription>
                Usa el mismo vault documental del CRM para que la documentación quede visible en ambos sitios y siga enriqueciendo el perfil de la entidad.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[calc(85vh-120px)] overflow-y-auto p-6">
            {corporateDocumentsData ? (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-sm font-medium text-emerald-900">
                  {corporateDocumentsData.uploaded_count} de {corporateDocumentsData.total_required} documentos clave preparados
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  Si subes una nueva versión, reemplazará automáticamente la vigente para ese tipo documental.
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
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
                                'pointer-events-none absolute right-0 top-0 border-emerald-200 bg-emerald-50 text-emerald-700 transition-opacity',
                                isDeleting ? 'opacity-0' : 'group-hover:opacity-0',
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
                              <p
                                className="truncate text-sm font-medium text-foreground"
                                title={uploadedDocument.filename}
                              >
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
                            Súbelo una vez y quedará disponible tanto aquí como en el CRM.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        type="button"
                        className="flex-1"
                        variant="outline"
                        disabled={isUploading}
                        onClick={() => openNativePicker(item.document_type_code)}
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
                          onClick={() => void handleDocumentDownload(uploadedDocument.id)}
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
                        onClick={() => void handleDocumentDownload(document.id)}
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
                    className="border-muted-foreground/20 bg-background text-muted-foreground"
                  >
                    Opcional
                  </Badge>
                </div>

                <div className="flex-1 space-y-4">
                  <button
                    type="button"
                    className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-5 text-center transition-colors hover:bg-muted/40"
                    onClick={() => openNativePicker(EXTRA_DOCUMENT_TYPE_CODE)}
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
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
            onChange={handleCatalogFileUpload}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteDocument !== null}
        onOpenChange={(open) => {
          if (!open && deletingDocumentId === null) {
            setPendingDeleteDocument(null);
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

export default EntityDocuments;
