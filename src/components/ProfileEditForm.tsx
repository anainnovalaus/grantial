import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface ProfileEditFormProps {
  profile: ProfileData;
  entityId: string;
  onCancel: () => void;
  onSave: (profile: ProfileData) => void;
}

const tipoEmpresaOptions = [
  { value: "SL", label: "Sociedad Limitada (S.L.)" },
  { value: "SA", label: "Sociedad Anónima (S.A.)" },
  { value: "Autonomo", label: "Autónomo" },
  { value: "SLL", label: "Sociedad Limitada Laboral (S.L.L.)" },
  { value: "SLU", label: "Sociedad Limitada Unipersonal (S.L.U.)" },
  { value: "Cooperativa", label: "Cooperativa" },
  { value: "Otra", label: "Otra" },
];

const comunidadAutonomaOptions = [
  { value: "andalucia", label: "Andalucía" },
  { value: "aragon", label: "Aragón" },
  { value: "asturias", label: "Asturias" },
  { value: "baleares", label: "Baleares" },
  { value: "canarias", label: "Canarias" },
  { value: "cantabria", label: "Cantabria" },
  { value: "castilla_leon", label: "Castilla y León" },
  { value: "castilla_mancha", label: "Castilla-La Mancha" },
  { value: "catalunya", label: "Cataluña" },
  { value: "comunidad_valenciana", label: "Comunidad Valenciana" },
  { value: "extremadura", label: "Extremadura" },
  { value: "galicia", label: "Galicia" },
  { value: "madrid", label: "Madrid" },
  { value: "murcia", label: "Murcia" },
  { value: "navarra", label: "Navarra" },
  { value: "pais_vasco", label: "País Vasco" },
  { value: "rioja", label: "La Rioja" },
  { value: "ceuta", label: "Ceuta" },
  { value: "melilla", label: "Melilla" },
];

function getTipoEmpresaValue(profileData: ProfileData) {
  if (!profileData.tipo_empresa) return '';
  
  const exactMatch = tipoEmpresaOptions.find(option => 
    option.value === profileData.tipo_empresa || option.label === profileData.tipo_empresa
  );
  
  if (exactMatch) return exactMatch.value;
  
  const labelMatch = tipoEmpresaOptions.find(option => 
    profileData.tipo_empresa?.includes(option.label) || 
    option.label.includes(profileData.tipo_empresa || '')
  );
  
  return labelMatch ? labelMatch.value : '';
}

function getComunidadAutonomaValue(comunidad?: string) {
  if (!comunidad) return '';
  
  const exactMatch = comunidadAutonomaOptions.find(option => 
    option.value === comunidad || option.label === comunidad
  );
  
  if (exactMatch) return exactMatch.value;
  
  const labelMatch = comunidadAutonomaOptions.find(option => 
    comunidad.includes(option.label) || 
    option.label.includes(comunidad)
  );
  
  return labelMatch ? labelMatch.value : '';
}

function formatDateForInput(dateString?: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return '';
  }
}

const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ profile, entityId, onCancel, onSave }) => {
  const formInitializedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProfileData>(() => {
    console.log("Initial form data setup with profile:", profile);
    
    const initialData = {
      ...profile,
      concesion_minimis: profile.minimis ?? profile.concesion_minimis,
      tipo_empresa: getTipoEmpresaValue(profile),
      comunidad_autonoma: getComunidadAutonomaValue(profile.comunidad_autonoma),
      comunidad_autonoma_centro_trabajo: getComunidadAutonomaValue(profile.comunidad_autonoma_centro_trabajo),
      fecha_constitucion: formatDateForInput(profile.fecha_constitucion),
    };
    
    formInitializedRef.current = true;
    console.log("Form initialized with data:", initialData);
    return initialData;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'personal_en_linea' || name === 'porcentaje_liderado_por_mujeres' || name === 'concesion_minimis') {
      const numValue =
        value === ''
          ? undefined
          : name === 'concesion_minimis'
            ? Number.parseFloat(value)
            : Number.parseInt(value, 10);
      console.log(`Setting ${name} to:`, numValue, "from input value:", value);
      
      setFormData(prev => ({
        ...prev,
        [name]: numValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBooleanChange = (value: string, name: string) => {
    const boolValue = value === 'si';
    setFormData(prev => ({
      ...prev,
      [name === 'liderado_mujeres' ? 'liderado_por_mujeres' : name]: boolValue,
      ...(name === 'liderado_mujeres' && !boolValue ? { porcentaje_liderado_por_mujeres: undefined } : {})
    }));
  };

  const handleNumberInputChange = (name: string, value: number | undefined) => {
    console.log(`handleNumberInputChange for ${name}:`, value);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const renderNumberInput = (
    id: string, 
    name: string, 
    value: number | undefined, 
    min: string = "0", 
    max: string = ""
  ) => {
    return (
      <Input 
        id={id}
        name={name}
        type="number"
        min={min}
        max={max}
        value={value === undefined ? '' : value}
        onChange={handleChange}
        onArrowClick={(newValue) => handleNumberInputChange(name, newValue)}
        className="number-input-custom"
      />
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentFormData = { ...formData };
    console.log("Form submitted with current formData:", currentFormData);
    console.log("personal_en_linea value at submission time:", currentFormData.personal_en_linea);
    
    setIsSubmitting(true);
    
    try {
      if (currentFormData.facturacion_anual) {
        currentFormData.facturacion_anual = currentFormData.facturacion_anual.replace(/[€$.,\s]/g, "");
      }
      
      const selectedTipoEmpresa = tipoEmpresaOptions.find(option => 
        option.value === currentFormData.tipo_empresa
      );
      
      if (selectedTipoEmpresa) {
        currentFormData.tipo_empresa = selectedTipoEmpresa.label;
      }
      
      const selectedComunidadAutonoma = comunidadAutonomaOptions.find(option => 
        option.value === currentFormData.comunidad_autonoma
      );
      
      if (selectedComunidadAutonoma) {
        currentFormData.comunidad_autonoma = selectedComunidadAutonoma.label;
      }
      
      const selectedCentroTrabajo = comunidadAutonomaOptions.find(option => 
        option.value === currentFormData.comunidad_autonoma_centro_trabajo
      );
      
      if (selectedCentroTrabajo) {
        currentFormData.comunidad_autonoma_centro_trabajo = selectedCentroTrabajo.label;
      }
      
      if (currentFormData.personal_en_linea !== undefined) {
        currentFormData.personal_en_linea = Number(currentFormData.personal_en_linea);
      }
      
      if (currentFormData.porcentaje_liderado_por_mujeres !== undefined) {
        currentFormData.porcentaje_liderado_por_mujeres = Number(currentFormData.porcentaje_liderado_por_mujeres);
      }

      if (currentFormData.concesion_minimis !== undefined && currentFormData.concesion_minimis !== null) {
        currentFormData.concesion_minimis = Number(currentFormData.concesion_minimis);
      }
      currentFormData.minimis = currentFormData.concesion_minimis ?? null;
      
      console.log("Final submission data:", currentFormData);
      console.log("personal_en_linea final value:", currentFormData.personal_en_linea);
      
      const jsonPayload = JSON.stringify({ 
        entity_id: entityId,
        profile: currentFormData 
      });
      
      console.log("JSON payload to be sent:", jsonPayload);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/update_entity_profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonPayload,
      });
      
      const data = await response.json();
      console.log("Response from server:", data);
      
      if (data.success) {
        toast.success('Perfil actualizado correctamente');
        onSave(currentFormData);
      } else {
        toast.error(data.message || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      toast.error('Error al actualizar el perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <h2 className="text-xl font-bold">Editar perfil</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Información general</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="razon_social">Razón social</Label>
              <Input 
                id="razon_social"
                name="razon_social"
                value={formData.razon_social}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input 
                id="nif"
                name="nif"
                value={formData.nif}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_empresa">Forma jurídica</Label>
              <Select 
                name="tipo_empresa"
                value={formData.tipo_empresa || ''}
                onValueChange={(value) => handleSelectChange(value, "tipo_empresa")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  {tipoEmpresaOptions.map(option => (
                    <SelectItem className="cursor-pointer" key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pagina_web">Página web</Label>
              <Input 
                id="pagina_web"
                name="pagina_web"
                type="url"
                value={formData.pagina_web || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input 
                id="telefono"
                name="telefono"
                value={formData.telefono || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correo">Correo electrónico</Label>
              <Input 
                id="correo"
                name="correo"
                type="email"
                value={formData.correo || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion_social">Dirección social</Label>
              <Input 
                id="direccion_social"
                name="direccion_social"
                value={formData.direccion_social || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comunidad_autonoma">Comunidad autónoma</Label>
              <Select 
                name="comunidad_autonoma"
                value={formData.comunidad_autonoma || ''}
                onValueChange={(value) => handleSelectChange(value, "comunidad_autonoma")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  {comunidadAutonomaOptions.map(option => (
                    <SelectItem className="cursor-pointer" key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comunidad_autonoma_centro_trabajo">Centro de trabajo</Label>
              <Select 
                name="comunidad_autonoma_centro_trabajo"
                value={formData.comunidad_autonoma_centro_trabajo || ''}
                onValueChange={(value) => handleSelectChange(value, "comunidad_autonoma_centro_trabajo")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  {comunidadAutonomaOptions.map(option => (
                    <SelectItem className="cursor-pointer" key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_constitucion">Fecha de constitución</Label>
              <Input 
                id="fecha_constitucion"
                name="fecha_constitucion"
                type="date"
                className="cursor-pointer"
                value={formData.fecha_constitucion || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="liderado_mujeres">Liderado por mujeres</Label>
              <Select 
                name="liderado_mujeres"
                value={formData.liderado_por_mujeres === true ? 'si' : formData.liderado_por_mujeres === false ? 'no' : ''}
                onValueChange={(value) => handleBooleanChange(value, "liderado_mujeres")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="cursor-pointer" value="si">Sí</SelectItem>
                  <SelectItem className="cursor-pointer" value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.liderado_por_mujeres && (
              <div className="space-y-2">
                <Label htmlFor="porcentaje_liderado_por_mujeres">Porcentaje de mujeres (%)</Label>
                {renderNumberInput(
                  "porcentaje_liderado_por_mujeres",
                  "porcentaje_liderado_por_mujeres",
                  formData.porcentaje_liderado_por_mujeres,
                  "0",
                  "100"
                )}
              </div>
            )}
          </div>

          <div className="space-y-1 pt-2">
            <h3 className="text-lg font-semibold">Información económica</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnae">CNAE</Label>
              <Input 
                id="cnae"
                name="cnae"
                value={formData.cnae || ''}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">Sector</Label>
              <Input 
                id="sector"
                name="sector"
                value={formData.sector}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facturacion_anual">Facturación anual</Label>
              <Input 
                id="facturacion_anual"
                name="facturacion_anual"
                value={formData.facturacion_anual}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personal_en_linea">Personal en línea</Label>
              {renderNumberInput("personal_en_linea", "personal_en_linea", formData.personal_en_linea)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="concesion_minimis">Concesión de Minimis</Label>
              <Input
                id="concesion_minimis"
                name="concesion_minimis"
                type="number"
                min="0"
                step="0.01"
                value={formData.concesion_minimis ?? ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="objeto_social">Objeto social</Label>
              <Input 
                id="objeto_social"
                name="objeto_social"
                value={formData.objeto_social || ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-1 pt-2">
            <h3 className="text-lg font-semibold">Administración</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre_representante">Representante legal</Label>
              <Input 
                id="nombre_representante"
                name="nombre_representante"
                value={formData.nombre_representante || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="administrador_cargo">Cargo</Label>
              <Input 
                id="administrador_cargo"
                name="administrador_cargo"
                value={formData.administrador_cargo || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="administrador_año">Año del cargo</Label>
              <Input 
                id="administrador_año"
                name="administrador_año"
                value={formData.administrador_año || ''}
                onChange={handleChange}
              />
            </div>
          </div>
          
          <div className="space-y-2 pt-2 col-span-full">
            <Label htmlFor="descripcion">Descripción de la empresa</Label>
            <Textarea 
              id="descripcion"
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={5}
              className="w-full h-56"
              placeholder="Escribe una breve descripción de la empresa"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default ProfileEditForm;
