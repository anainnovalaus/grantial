import React from 'react';
import { Briefcase, Edit, Building, Calendar, UserCircle, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { formatAmount } from '@/lib/utils';


interface ProfileData {
  razon_social: string;
  nombre_representante?: string;
  pagina_web?: string;
  comunidad_autonoma?: string;
  comunidad_autonoma_centro_trabajo?: string;
  telefono?: string;
  correo?: string;
  nif: string;
  descripcion: string;
  tipo_empresa?: string;
  fecha_constitucion?: string;
  personal_en_linea?: number;
  liderado_por_mujeres?: boolean;
  porcentaje_liderado_por_mujeres?: number;
  sector: string;
  facturacion_anual: string;
  direccion_social?: string;
  cnae?: string;
  objeto_social?: string;
  administrador_cargo?: string;
  administrador_año?: string;
  minimis?: number | null;
  concesion_minimis?: number | null;
}


interface ProfileCardProps {
  profile: ProfileData;
  onEdit: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onEdit }) => {
  const minimisValue = profile.minimis ?? profile.concesion_minimis;

  // Format date if exists
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No especificada';
    
    try {
      // Check if the date is already in DD/MM/YYYY format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
        return dateString;
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      
      // Format as DD/MM/YYYY
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Format boolean value for display
  const formatBoolean = (value?: boolean): string => {
    if (typeof value === 'undefined') return 'No especificado';
    return value ? 'Sí' : 'No';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="bg-primary/10 p-2.5 sm:p-3 rounded-full shrink-0">
              <Building className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold leading-tight truncate">{profile.razon_social}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {profile.tipo_empresa ? `${profile.tipo_empresa} · ` : ''}
                {profile.nif ? `NIF: ${profile.nif}` : ''}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            className="rounded-full h-8 w-8 shrink-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <Accordion type="single" collapsible defaultValue="general" className="w-full">
          <AccordionItem value="general">
            <AccordionTrigger className="text-base font-medium py-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                <span>Información general</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {profile.descripcion && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Descripción</h3>
                    <p className="text-sm mt-1">{profile.descripcion}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {profile.direccion_social && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Dirección social</h3>
                      <p className="text-sm mt-1">{profile.direccion_social}</p>
                    </div>
                  )}
                  
                  {profile.comunidad_autonoma && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Comunidad autónoma</h3>
                      <p className="text-sm mt-1">{profile.comunidad_autonoma}</p>
                    </div>
                  )}

                  {profile.comunidad_autonoma_centro_trabajo && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Centro de trabajo</h3>
                      <p className="text-sm mt-1">{profile.comunidad_autonoma_centro_trabajo}</p>
                    </div>
                  )}
                  
                  {profile.pagina_web && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        Página Web <Globe className="h-4 w-4 text-muted-foreground" />
                      </h3>
                      <p className="text-sm mt-1">
                        <a
                          href={profile.pagina_web.startsWith('http') ? profile.pagina_web : `https://${profile.pagina_web}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {profile.pagina_web}
                        </a>
                      </p>
                    </div>
                  )}

                </div>
                
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-4">
                  {profile.fecha_constitucion && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Fecha constitución</h3>
                      <p className="text-sm mt-1">{formatDate(profile.fecha_constitucion)}</p>
                    </div>
                  )}
                  
                  {typeof profile.liderado_por_mujeres !== 'undefined' && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Liderado por mujeres</h3>
                      <p className="text-sm mt-1">{formatBoolean(profile.liderado_por_mujeres)}</p>
                    </div>
                  )}
                  
                  {profile.liderado_por_mujeres && typeof profile.porcentaje_liderado_por_mujeres !== 'undefined' && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Porcentaje de mujeres (%)</h3>
                      <p className="text-sm mt-1">{profile.porcentaje_liderado_por_mujeres}%</p>
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="contacto">
            <AccordionTrigger className="text-base font-medium py-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>Contacto</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.telefono && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      Teléfono <Phone className="h-4 w-4 text-muted-foreground" />
                    </h3>
                    <p className="text-sm mt-1">{profile.telefono}</p>
                  </div>
                )}
                
                {profile.correo && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      Correo <Mail className="h-4 w-4 text-muted-foreground" />
                    </h3>
                    <p className="text-sm mt-1">{profile.correo}</p>
                  </div>
                )}

              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="economica">
            <AccordionTrigger className="text-base font-medium py-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <span>Información económica</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-4">
                {profile.sector && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Sector</h3>
                    <p className="text-sm mt-1">{profile.sector}</p>
                  </div>
                )}
                
                {profile.cnae && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">CNAE</h3>
                    <p className="text-sm mt-1">{profile.cnae}</p>
                  </div>
                )}
                
                {profile.facturacion_anual && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Facturación anual</h3>
                    <p className="text-sm mt-1">{formatAmount(profile.facturacion_anual)}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Concesión de Minimis</h3>
                  <p className="text-sm mt-1">
                    {formatAmount(String(minimisValue ?? 0))}
                  </p>
                </div>
                
                {typeof profile.personal_en_linea !== 'undefined' && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Personal en línea</h3>
                    <p className="text-sm mt-1">{profile.personal_en_linea}</p>
                  </div>
                )}
                
                {profile.objeto_social && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Objeto social</h3>
                    <p className="text-sm mt-1">{profile.objeto_social}</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="administracion">
            <AccordionTrigger className="text-base font-medium py-2">
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                <span>Administración</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.nombre_representante && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Representante legal</h3>
                    <p className="text-sm mt-1">{profile.nombre_representante}</p>
                  </div>
                )}
                
                {profile.administrador_cargo && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Cargo</h3>
                    <p className="text-sm mt-1">{profile.administrador_cargo}</p>
                  </div>
                )}
                
                {profile.administrador_año && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Año del cargo</h3>
                    <p className="text-sm mt-1">{profile.administrador_año}</p>
                  </div>
                )}
              
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;
