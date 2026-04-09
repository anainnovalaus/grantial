import { useState, useCallback } from 'react';

interface MarketplaceFilters {
  beneficiarios: string[];
  regiones: string[];
  finalidades: string[];
  administraciones_convocantes: string[];
  tipos_ayuda: string[];
}

export const useMarketplaceFilters = () => {
  const [filters, setFilters] = useState<MarketplaceFilters>({
    beneficiarios: [],
    regiones: [],
    finalidades: [],
    administraciones_convocantes: [],
    tipos_ayuda: [],
  });

  const updateFilter = useCallback((
    filterType: keyof MarketplaceFilters,
    value: string
  ) => {
    setFilters((prev) => {
      const currentValues = prev[filterType];
      const isSelected = currentValues.includes(value);

      // Permitir múltiples selecciones para todos los filtros
      return {
        ...prev,
        [filterType]: isSelected
          ? currentValues.filter((v) => v !== value)
          : [...currentValues, value],
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      beneficiarios: [],
      regiones: [],
      finalidades: [],
      administraciones_convocantes: [],
      tipos_ayuda: [],
    });
  }, []);

  const hasActiveFilters = 
    filters.beneficiarios.length > 0 || 
    filters.regiones.length > 0 || 
    filters.finalidades.length > 0 ||
    filters.administraciones_convocantes.length > 0 ||
    filters.tipos_ayuda.length > 0;

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  };
};
