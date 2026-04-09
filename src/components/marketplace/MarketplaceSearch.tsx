import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface MarketplaceSearchProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  resultsCount: number;
  isLoading?: boolean;
  orderByMode?: 'preferences' | 'match' | 'amount' | 'deadline';
  sortDirection?: 'asc' | 'desc';
}

interface Suggestion {
  id: string;
  titulo_corto: string;
}

export const MarketplaceSearch: React.FC<MarketplaceSearchProps> = ({
  searchQuery,
  onSearchChange,
  resultsCount,
  isLoading,
  orderByMode = 'preferences',
  sortDirection = 'desc',
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);

  // Fetch suggestions when user types
  useEffect(() => {
    // Si la última acción fue seleccionar una sugerencia, no buscar
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/search_grants_suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            search_query: searchQuery,
            limit: 10
          })
        });

        if (response.ok) {
          const data = await response.json();
          const results = data.suggestions || [];
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setSelectedIndex(-1);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex].titulo_corto);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectSuggestion = useCallback((title: string) => {
    justSelectedRef.current = true;
    onSearchChange(title);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, [onSearchChange]);

  return (
    <div className="w-full space-y-3">
      <div className="relative" ref={wrapperRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
        {isLoadingSuggestions && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground z-10 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar subvenciones..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          autoComplete="off"
          className="flex h-12 w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-dropdown absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onMouseDown={(e) => {
                  e.preventDefault(); // Previene que el input pierda focus antes del click
                  selectSuggestion(suggestion.titulo_corto);
                }}
                className={`
                  px-4 py-3 cursor-pointer transition-colors
                  ${index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                  }
                  ${index === 0 ? 'rounded-t-lg' : ''}
                  ${index === suggestions.length - 1 ? 'rounded-b-lg' : ''}
                `}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="text-sm text-foreground line-clamp-2">
                  {suggestion.titulo_corto}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        {isLoading ? (
          <span>Buscando...</span>
        ) : (
          <span>
            {resultsCount} subvención{resultsCount !== 1 ? 'es' : ''} encontrada{resultsCount !== 1 ? 's' : ''}{' '}
            {orderByMode === 'match' && ` - Ordenadas por compatibilidad con tu entidad (${sortDirection === 'desc' ? 'descendente' : 'ascendente'}).`}
            {orderByMode === 'amount' && ` - Ordenadas por importe (${sortDirection === 'desc' ? 'de mayor a menor' : 'de menor a mayor'}).`}
            {orderByMode === 'deadline' && ` - Ordenadas por plazo (${sortDirection === 'desc' ? 'de más lejano a más próximo' : 'de más próximo a más lejano'}).`}
            {orderByMode === 'preferences' && ` - Ordenadas según encaje con tus preferencias (${sortDirection === 'desc' ? 'mejor a peor' : 'peor a mejor'}).`}
          </span>
        )}
      </div>
    </div>
  );
};
