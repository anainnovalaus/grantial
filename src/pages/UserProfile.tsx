import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  CreditCard,
  Edit,
  FileText,
  Heart,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const apiUrl = import.meta.env.VITE_API_URL;
const CHAT_DAILY_LIMIT = 8;

interface NotificationPreferences {
  smsUpdates: boolean;
  emailUpdates: boolean;
  darkMode: boolean;
}

interface UserProfileData {
  name: string;
  email: string;
  phone: string;
  registration_date: string;
  preferences: NotificationPreferences;
}

interface FavoriteGrant {
  grant_id: string | number;
  titulo_corto: string;
  numero_match?: number | null;
  presupuesto?: string | null;
  fecha_limite?: string | null;
  favorited_at?: string | null;
}

interface UserAlert {
  id: number;
  alert_name: string;
  is_active: boolean;
  filters?: {
    beneficiarios?: string[];
    regiones?: string[];
    finalidades?: string[];
  };
}

interface ChatLimits {
  remaining: number;
  reset_time: string;
  message_count: number;
  allowed: boolean;
}

interface SubscriptionInvoice {
  id: string;
  number: string;
  issueDate: string;
  amount: string;
  status: 'paid' | 'pending';
}

const emptyProfileData: UserProfileData = {
  name: '',
  email: '',
  phone: '',
  registration_date: '',
  preferences: {
    darkMode: false,
    emailUpdates: true,
    smsUpdates: true,
  },
};

const getAuthHeaders = (includeJson = false) => {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {};

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const formatShortDate = (value?: string | null) => {
  if (!value) return 'No disponible';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const UserProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showPwModal, setShowPwModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<1 | 2>(1);
  const [showManageSubscriptionModal, setShowManageSubscriptionModal] = useState(false);
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [favorites, setFavorites] = useState<FavoriteGrant[]>([]);
  const [alerts, setAlerts] = useState<UserAlert[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingPreferenceKey, setSavingPreferenceKey] = useState<keyof NotificationPreferences | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<UserProfileData>(emptyProfileData);
  const [formData, setFormData] = useState<UserProfileData>(emptyProfileData);
  const [chatLimits, setChatLimits] = useState<ChatLimits>({
    remaining: CHAT_DAILY_LIMIT,
    reset_time: '00:00',
    message_count: 0,
    allowed: true,
  });
  const [chatLimitsLoading, setChatLimitsLoading] = useState(false);

  const issuedInvoices: SubscriptionInvoice[] = [];

  useEffect(() => {
    if (!user?.id) return;

    void fetchUserProfile();
    void fetchProfileFavorites();
    void fetchProfileAlerts();
    void fetchChatLimits(user.id);
  }, [user?.id]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${apiUrl}/api/get_user_profile`, {
        method: 'GET',
        headers: getAuthHeaders(true),
      });

      if (!response.ok) {
        toast.error('Error al cargar el perfil del usuario');
        return;
      }

      const data = await response.json();
      const profile = data.profile;

      const mapped: UserProfileData = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? '',
        registration_date: profile.created_at,
        preferences: {
          smsUpdates: profile.preferences?.smsUpdates ?? true,
          emailUpdates: profile.preferences?.emailUpdates ?? true,
          darkMode: profile.preferences?.darkMode ?? false,
        },
      };

      setProfileData(mapped);
      setFormData(mapped);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Error al cargar el perfil del usuario');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileFavorites = async () => {
    setFavoritesLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/favorites`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setFavoritesLoading(false);
    }
  };

  const fetchProfileAlerts = async () => {
    setAlertsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/alerts`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const fetchChatLimits = async (userId: string) => {
    try {
      setChatLimitsLoading(true);
      const response = await fetch(`${apiUrl}/api/get_chat_limits?user_id=${userId}`, {
        method: 'GET',
      });

      if (!response.ok) return;

      const data = await response.json();
      setChatLimits({
        remaining: typeof data.remaining === 'number' ? data.remaining : CHAT_DAILY_LIMIT,
        reset_time: data.reset_time || '00:00',
        message_count: typeof data.message_count === 'number' ? data.message_count : 0,
        allowed: Boolean(data.allowed ?? true),
      });
    } catch (error) {
      console.error('Error fetching chat limits:', error);
    } finally {
      setChatLimitsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${apiUrl}/api/update_user_profile`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          user_id: user?.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          preferences: formData.preferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Error updating profile');
      }

      setProfileData(formData);
      setIsEditing(false);
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(profileData);
  };

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      setSavingPreferenceKey(key);

      const response = await fetch(`${apiUrl}/api/update_user_preferences`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          user_id: user?.id,
          [key]: value,
        }),
      });

      if (!response.ok) {
        throw new Error('Error updating preferences');
      }

      setFormData((previous) => ({
        ...previous,
        preferences: { ...previous.preferences, [key]: value },
      }));
      setProfileData((previous) => ({
        ...previous,
        preferences: { ...previous.preferences, [key]: value },
      }));

      toast.success('Preferencia actualizada');
    } catch (error) {
      console.error('Error al modificar la preferencia:', error);
      toast.error('Error al modificar la preferencia');
    } finally {
      setSavingPreferenceKey(null);
    }
  };

  const removeFavoriteFromProfile = async (grantId: string | number) => {
    try {
      const response = await fetch(`${apiUrl}/api/favorites/remove`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ grant_id: grantId }),
      });

      if (response.ok) {
        toast.success('Favorito eliminado');
        void fetchProfileFavorites();
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Error al eliminar favorito');
    }
  };

  const toggleAlertFromProfile = async (alertId: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/alerts/${alertId}/toggle`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success('Estado de alerta cambiado');
        void fetchProfileAlerts();
      }
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast.error('Error al cambiar estado de alerta');
    }
  };

  const deleteAlertFromProfile = async (alertId: number) => {
    try {
      const response = await fetch(`${apiUrl}/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success('Alerta eliminada');
        void fetchProfileAlerts();
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast.error('Error al eliminar alerta');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast.error('Rellena todos los campos');
      return;
    }

    if (newPw !== confirmPw) {
      toast.error('La nueva contraseña no coincide');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${apiUrl}/api/change_password`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          user_id: user?.id,
          current_password: currentPw,
          new_password: newPw,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || 'No se pudo cambiar la contraseña');
      }

      toast.success('Contraseña cambiada');
      setShowPwModal(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteModal(false);
    setDeleteConfirmationStep(1);

    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/delete_user_account`, {
        method: 'DELETE',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ user_id: user?.id }),
      });

      if (!response.ok) {
        throw new Error('Error eliminando cuenta');
      }

      toast.success('Cuenta eliminada');
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Error eliminando cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModalChange = (open: boolean) => {
    setShowDeleteModal(open);

    if (!open) {
      setDeleteConfirmationStep(1);
    }
  };

  const chatCreditsUsed = Math.max(0, chatLimits.message_count);
  const chatCreditsProgress = Math.min(100, (chatCreditsUsed / CHAT_DAILY_LIMIT) * 100);

  if (loading && !profileData.name) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex flex-1 items-center justify-center px-4 pt-20 pb-16">
          <div>Cargando perfil...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 justify-center px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl space-y-6">
          <section className="space-y-4 px-1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/15">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
                    <Badge variant="secondary" className="bg-muted/60">
                      Workspace de {profileData.name || 'tu cuenta'}
                    </Badge>
                  </div>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Centraliza tu información de cuenta, preferencias, seguridad y la futura gestión de suscripción desde un solo sitio.
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-auto sm:min-w-[180px] rounded-xl border bg-background/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-none">{chatLimits.remaining}</p>
                    <p className="text-xs text-muted-foreground">Créditos chat restantes</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Tabs defaultValue="personal" className="space-y-5">
            <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl border bg-muted/40 p-2">
              <TabsTrigger value="personal" className="rounded-xl px-4 py-2.5">
                Información personal
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-xl px-4 py-2.5">
                Seguridad
              </TabsTrigger>
              <TabsTrigger value="communications" className="rounded-xl px-4 py-2.5">
                Comunicaciones
              </TabsTrigger>
              <TabsTrigger value="subscription" className="rounded-xl px-4 py-2.5">
                Suscripción
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        <CardTitle>Detalles</CardTitle>
                      </div>
                      <CardDescription className="mt-2">
                        Información básica de la cuenta que usarás en comunicaciones, soporte y futuras configuraciones de billing.
                      </CardDescription>
                    </div>
                    <Button
                      variant={isEditing ? 'secondary' : 'outline'}
                      onClick={() => setIsEditing((previous) => !previous)}
                      disabled={loading}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {isEditing ? 'Editando detalles' : 'Editar detalles'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre completo</Label>
                      {isEditing ? (
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(event) =>
                            setFormData((previous) => ({ ...previous, name: event.target.value }))
                          }
                          disabled={loading}
                        />
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{profileData.name || 'No especificado'}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Correo electrónico</Label>
                      {isEditing ? (
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(event) =>
                            setFormData((previous) => ({ ...previous, email: event.target.value }))
                          }
                          disabled={loading}
                        />
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{profileData.email || 'No especificado'}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      {isEditing ? (
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(event) =>
                            setFormData((previous) => ({ ...previous, phone: event.target.value }))
                          }
                          disabled={loading}
                        />
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{profileData.phone || 'No especificado'}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Fecha de registro</Label>
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatShortDate(profileData.registration_date)}</span>
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <>
                      <Separator />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={loading}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={loading}>
                          {loading ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-primary" />
                      <CardTitle>Favoritos</CardTitle>
                      {favorites.length > 0 ? (
                        <Badge variant="secondary">{favorites.length}</Badge>
                      ) : null}
                    </div>
                    <CardDescription>
                      Las subvenciones que has guardado para revisar o tramitar más tarde.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {favoritesLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando favoritos...</p>
                    ) : favorites.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-muted/20 p-5">
                        <p className="text-sm font-medium">Aún no tienes favoritos guardados</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Explora el marketplace y guarda subvenciones para tenerlas aquí siempre a mano.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {favorites.map((favorite) => (
                          <div
                            key={favorite.grant_id}
                            className="flex items-start justify-between gap-3 rounded-xl border p-3"
                          >
                            <div
                              className="min-w-0 flex-1 cursor-pointer"
                              onClick={() => navigate(`/grants/${favorite.grant_id}`)}
                            >
                              <h4 className="truncate text-sm font-medium hover:text-primary">
                                {favorite.titulo_corto}
                              </h4>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Match: {typeof favorite.numero_match === 'number' ? `${favorite.numero_match}%` : 'No disponible'}
                                {' · '}
                                Fondos: {favorite.presupuesto || 'No disponible'}
                                {' · '}
                                Plazo: {favorite.fecha_limite || 'No disponible'}
                              </p>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeFavoriteFromProfile(favorite.grant_id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      <CardTitle>Alertas</CardTitle>
                      {alerts.length > 0 ? <Badge variant="secondary">{alerts.length}</Badge> : null}
                    </div>
                    <CardDescription>
                      Filtros guardados que puedes activar o pausar para recibir nuevas oportunidades.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {alertsLoading ? (
                      <p className="text-sm text-muted-foreground">Cargando alertas...</p>
                    ) : alerts.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-muted/20 p-5">
                        <p className="text-sm font-medium">No tienes alertas configuradas</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Guarda tus filtros desde el marketplace y aparecerán aquí para gestionarlas.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {alerts.map((alert) => (
                          <div key={alert.id} className="rounded-xl border p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-medium">{alert.alert_name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {alert.is_active ? 'Activa y enviando coincidencias' : 'Pausada'}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={alert.is_active}
                                  onCheckedChange={() => toggleAlertFromProfile(alert.id)}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => deleteAlertFromProfile(alert.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {(alert.filters?.beneficiarios || []).map((item) => (
                                <Badge key={`${alert.id}-b-${item}`} variant="outline" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                              {(alert.filters?.regiones || []).map((item) => (
                                <Badge key={`${alert.id}-r-${item}`} variant="outline" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                              {(alert.filters?.finalidades || []).map((item) => (
                                <Badge key={`${alert.id}-f-${item}`} variant="outline" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <CardTitle>Seguridad de la cuenta</CardTitle>
                  </div>
                  <CardDescription>
                    Controla el acceso, la contraseña y las acciones sensibles de tu usuario.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Acceso principal</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tu cuenta está asociada a {profileData.email || 'tu correo principal'}.
                    </p>
                  </div>

                  <Dialog open={showPwModal} onOpenChange={setShowPwModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        Cambiar contraseña
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cambiar contraseña</DialogTitle>
                        <DialogDescription>
                          Introduce tu contraseña actual y define una nueva credencial segura.
                        </DialogDescription>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Te recomendamos usar al menos 8 caracteres, con mayúsculas, minúsculas, números y símbolos.
                        </p>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div>
                          <Label htmlFor="currentPw">Actual</Label>
                          <Input
                            id="currentPw"
                            type="password"
                            value={currentPw}
                            onChange={(event) => setCurrentPw(event.target.value)}
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <Label htmlFor="newPw">Nueva contraseña</Label>
                          <Input
                            id="newPw"
                            type="password"
                            value={newPw}
                            onChange={(event) => setNewPw(event.target.value)}
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <Label htmlFor="confirmPw">Confirmar contraseña</Label>
                          <Input
                            id="confirmPw"
                            type="password"
                            value={confirmPw}
                            onChange={(event) => setConfirmPw(event.target.value)}
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowPwModal(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleChangePassword} disabled={loading}>
                          {loading ? 'Cambiando...' : 'Cambiar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card className="border-destructive/25">
                <CardHeader>
                  <CardTitle className="text-destructive">Zona sensible</CardTitle>
                  <CardDescription>
                    Acciones irreversibles asociadas a tu cuenta y a todos sus datos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog open={showDeleteModal} onOpenChange={handleDeleteModalChange}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive hover:text-destructive"
                      >
                        Eliminar cuenta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {deleteConfirmationStep === 1 ? 'Eliminar cuenta' : 'Confirmación final'}
                        </DialogTitle>
                        <DialogDescription>
                          {deleteConfirmationStep === 1
                            ? 'Esta acción inicia el proceso de eliminación de tu cuenta.'
                            : 'Vas a perder el acceso a tu cuenta y todos tus datos se eliminarán de forma permanente.'}
                        </DialogDescription>
                      </DialogHeader>
                      {deleteConfirmationStep === 2 ? (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
                          Después de confirmar, no podrás iniciar sesión de nuevo ni recuperar tu historial, alertas,
                          favoritos o configuraciones asociadas a esta cuenta.
                        </div>
                      ) : null}
                      <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => handleDeleteModalChange(false)}>
                          Cancelar
                        </Button>
                        {deleteConfirmationStep === 1 ? (
                          <Button
                            variant="destructive"
                            onClick={() => setDeleteConfirmationStep(2)}
                            disabled={loading}
                          >
                            Continuar
                          </Button>
                        ) : (
                          <Button variant="destructive" onClick={handleDeleteAccount} disabled={loading}>
                            {loading ? 'Eliminando...' : 'Sí, eliminar definitivamente'}
                          </Button>
                        )}
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="communications" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    <CardTitle>Comunicaciones</CardTitle>
                  </div>
                  <CardDescription>
                    Decide por qué canales quieres recibir novedades, alertas y avisos de la plataforma.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">Notificaciones por teléfono</h3>
                      <p className="text-xs text-muted-foreground">
                        Recibe avisos rápidos relacionados con nuevas subvenciones y actividad importante.
                      </p>
                    </div>
                    <Switch
                      checked={formData.preferences.smsUpdates}
                      onCheckedChange={(checked) => handlePreferenceChange('smsUpdates', checked)}
                      disabled={loading || savingPreferenceKey !== null}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">Actualizaciones por email</h3>
                      <p className="text-xs text-muted-foreground">
                        Resúmenes, novedades de producto, cambios de cuenta y comunicaciones importantes.
                      </p>
                    </div>
                    <Switch
                      checked={formData.preferences.emailUpdates}
                      onCheckedChange={(checked) => handlePreferenceChange('emailUpdates', checked)}
                      disabled={loading || savingPreferenceKey !== null}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle>Resumen de contacto</CardTitle>
                  </div>
                  <CardDescription>
                    Canales principales que usaremos para contactarte cuando activemos más automatizaciones.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Email principal</p>
                    <p className="mt-2 text-sm font-medium">{profileData.email || 'No especificado'}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono principal</p>
                    <p className="mt-2 text-sm font-medium">{profileData.phone || 'No especificado'}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscription" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <CardTitle>Gestionar Suscripción</CardTitle>
                    </div>
                    <CardDescription>
                      Frontend preparado para centralizar plan, cobros, renovaciones y gestión de la suscripción cuando conectemos el proveedor.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Suscripción actual</p>
                        <p className="mt-2 text-base font-semibold">Pendiente de sincronización</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Esta tarjeta ya queda lista para mostrar el plan real en cuanto se conecte billing.
                        </p>
                      </div>
                      <div className="rounded-xl border bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Proveedor de pago</p>
                        <p className="mt-2 text-base font-semibold">Por definir</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Aquí mostraremos el estado del proveedor, método de cobro y próxima renovación.
                        </p>
                      </div>
                    </div>

                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <CardTitle>Créditos de chat</CardTitle>
                    </div>
                    <CardDescription>
                      Uso diario actual del asistente Granti según el límite real disponible ahora mismo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Créditos restantes hoy</p>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-3xl font-bold">{chatLimits.remaining}</span>
                        <span className="pb-1 text-sm text-muted-foreground">/ {CHAT_DAILY_LIMIT}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {chatLimitsLoading
                          ? 'Actualizando uso del chat...'
                          : `Se reinicia a las ${chatLimits.reset_time}.`}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Uso diario</span>
                        <span className="text-muted-foreground">
                          {chatCreditsUsed} usados
                        </span>
                      </div>
                      <Progress value={chatCreditsProgress} className="h-2.5" />
                    </div>

                    <Badge variant={chatLimits.allowed ? 'secondary' : 'destructive'}>
                      {chatLimits.allowed ? 'Créditos disponibles' : 'Límite diario alcanzado'}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle>Facturas emitidas</CardTitle>
                  </div>
                  <CardDescription>
                    Histórico de facturas y recibos de tu suscripción cuando el módulo de pagos esté conectado.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {issuedInvoices.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-muted/20 p-6">
                      <p className="text-sm font-medium">Todavía no hay facturas emitidas</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        En cuanto exista un proveedor de cobro conectado y se emitan cargos, aquí aparecerán tus facturas para consulta y descarga.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issuedInvoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between rounded-xl border p-4"
                        >
                          <div>
                            <p className="text-sm font-medium">{invoice.number}</p>
                            <p className="text-xs text-muted-foreground">
                              Emitida el {invoice.issueDate}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{invoice.amount}</p>
                            <Badge variant={invoice.status === 'paid' ? 'secondary' : 'outline'}>
                              {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gestión de la suscripción</CardTitle>
                  <CardDescription>
                    Accesos directos para actualizar billing, revisar el plan o tramitar una baja cuando la integración esté activa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  <Dialog
                    open={showManageSubscriptionModal}
                    onOpenChange={setShowManageSubscriptionModal}
                  >
                    <DialogTrigger asChild>
                      <Button className="sm:flex-1">
                        Gestionar suscripción
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Gestión de suscripción preparada</DialogTitle>
                        <DialogDescription>
                          El frontend ya está listo para abrir aquí el portal de cliente del proveedor de billing que decidáis.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button onClick={() => setShowManageSubscriptionModal(false)}>
                          Entendido
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog
                    open={showCancelSubscriptionModal}
                    onOpenChange={setShowCancelSubscriptionModal}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" className="sm:flex-1">
                        Dar de baja
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Baja de suscripción</DialogTitle>
                        <DialogDescription>
                          Cuando el proveedor esté integrado, esta acción permitirá cancelar o pausar la suscripción desde aquí sin salir de la cuenta.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelSubscriptionModal(false)}>
                          Cerrar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
