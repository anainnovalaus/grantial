import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, ArrowRightCircle, ArrowLeftCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAmount } from '@/lib/utils';
import { formatDeadline, getDeadlineIcon, getDeadlineStatus, getDeadlineStyles } from '@/lib/deadline';

interface GrantCardProps {
  title: string;
  amount: string;
  deadline: string;
  description: string;
  justificacion?: string;
  beneficiario?: string;
  lugar?: string;
  finalidad?: string;
  queRecibeBeneficiario?: string;
  grant_id?: string;
  matchPercentage?: number;
  showMatchBadge?: boolean;
  onViewDetails?: (grantId?: string) => void;
}

// Helper function to truncate title to a specific number of words
const truncateTitle = (title: string | undefined | null, maxWords: number = 6): string => {
  if (!title) return "Sin título";
  
  const words = title.split(' ');
  if (words.length <= maxWords) {
    return title;
  }
  return words.slice(0, maxWords).join(' ') + '...';
};

const GrantCard: React.FC<GrantCardProps> = ({
  title,
  amount,
  deadline,
  description,
  justificacion,
  beneficiario,
  lugar,
  finalidad,
  queRecibeBeneficiario,
  grant_id,
  matchPercentage,
  showMatchBadge = false,
  onViewDetails
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  
  console.log("GrantCard rendering with props:", { 
    title, 
    amount, 
    deadline, 
    description: description?.substring(0, 30) + "...", 
    grant_id,
    matchPercentage,
  });
  
  const formattedDeadline = formatDeadline(deadline);
  const deadlineStatus = getDeadlineStatus(deadline);
  const deadlineStyles = getDeadlineStyles(deadlineStatus);
  const formattedAmount = formatAmount(amount || "");
  const truncatedTitle = truncateTitle(title);
  const safeDescription = description || "Sin descripción";
  const beneficiaryReceivesValue = queRecibeBeneficiario || "No disponible";

  const getMatchBadgeStyles = () => {
    
    if (matchPercentage >= 70) {
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    } else if (matchPercentage >= 50) {
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    } else {
      return "bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400";
    }
  };

  const grantDetailsHref = `/grants/${grant_id ?? ''}`;

  const handleViewDetailsClick = () => {
    onViewDetails?.(grant_id);
  };

  const infoRowClass = "grid grid-cols-[112px_minmax(0,1fr)] gap-1.5 text-xs";
  const labelClass = "font-semibold text-foreground";
  const valueClass = "text-muted-foreground dark:text-gray-300";
  const formatRegion = (region?: string): string => {
    if (!region) return 'No especificado';
    let cleaned = region.replace(/^[A-Z0-9]+\s*-\s*/, '');
    cleaned = cleaned
      .toLocaleLowerCase('es-ES')
      .replace(/\p{L}+/gu, (word) => {
        const first = word.charAt(0).toLocaleUpperCase('es-ES');
        return `${first}${word.slice(1)}`;
      });
    return cleaned;
  };

  return (
    <div className="h-full [perspective:1200px]">
      <div
        className="relative h-full min-h-[308px] transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <Card className="absolute inset-0 h-full flex flex-col overflow-hidden [backface-visibility:hidden]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full border border-border bg-background/80 shadow-sm backdrop-blur"
            onClick={() => setIsFlipped(true)}
            aria-label="Ver resumen de la subvención"
          >
            <ArrowRightCircle className="h-5 w-5" />
          </Button>

          <CardHeader className="pb-1.5 pt-3.5 pr-14">
            <h3 className="text-base font-semibold text-foreground mb-1.5">
              {truncatedTitle}
            </h3>
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {showMatchBadge && matchPercentage !== undefined && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${getMatchBadgeStyles()}`}>
                    {matchPercentage}% compatible
                  </span>
                )}
              </div>
              <div className="flex items-center text-xs shrink-0">
                {getDeadlineIcon(deadlineStatus, `mr-1 h-3 w-3 ${deadlineStyles.textColor}`)}
                <span className={`${deadlineStyles.textColor} border-b-2 ${deadlineStyles.borderColor} whitespace-nowrap`}>
                  Plazo: {formattedDeadline}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-1.5 flex-grow">
            {justificacion && (
              <div className="mb-2">
                <h4 className="text-xs font-medium mb-1 text-foreground">Por qué encaja con tu perfil:</h4>
                <div
                  className="text-xs text-muted-foreground dark:text-gray-300 line-clamp-2 prose prose-xs max-w-none leading-relaxed [&>h3]:text-xs [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-3 [&>ul]:mb-3 [&>ul]:mt-2 [&>li]:mb-1 [&>p]:mb-2 [&>strong]:font-semibold text-justify hyphens-auto"
                  dangerouslySetInnerHTML={{ __html: justificacion }}
                />
              </div>
            )}

            <div className="border-t border-border pt-2.5 text-xs space-y-1.5">
              <div>
                <span className="font-medium text-foreground">Fondos Totales: </span>
                <span className="text-muted-foreground dark:text-gray-300">{formattedAmount}</span>
              </div>
              {beneficiario && (
                <div>
                  <span className="font-medium text-foreground">Beneficiario: </span>
                  <span className="text-muted-foreground dark:text-gray-300">{beneficiario}</span>
                </div>
              )}
              {lugar && (
                <div>
                  <span className="font-medium text-foreground">Lugar: </span>
                  <span className="text-muted-foreground dark:text-gray-300">{formatRegion(lugar)}</span>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="pt-0 pb-2 mt-auto">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full bg-primary/12 hover:bg-primary/18 text-primary border-primary/25"
            >
              <Link to={grantDetailsHref} onClick={handleViewDetailsClick}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Ver detalles completos
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card
          className="absolute inset-0 h-full flex flex-col overflow-hidden [backface-visibility:hidden]"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full border border-border bg-background/80 shadow-sm backdrop-blur"
            onClick={() => setIsFlipped(false)}
            aria-label="Volver al frente de la tarjeta"
          >
            <ArrowLeftCircle className="h-5 w-5" />
          </Button>

          <CardHeader className="pb-1.5 pt-3.5 pr-14">
            <h3 className="text-base font-semibold text-foreground leading-tight">
              Resumen de la subvención
            </h3>
            <p className="text-xs text-muted-foreground">{truncatedTitle}</p>
          </CardHeader>

          <CardContent className="pb-1.5 flex-grow space-y-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-1.5">
              <div className={infoRowClass}>
                <span className={labelClass}>Beneficiario</span>
                <span className={valueClass}>{beneficiario || 'No disponible'}</span>
              </div>
              <div className={infoRowClass}>
                <span className={labelClass}>Fondos totales</span>
                <span className={valueClass}>{formattedAmount}</span>
              </div>
              <div className={infoRowClass}>
                <span className={labelClass}>Plazo</span>
                <span className={valueClass}>{formattedDeadline}</span>
              </div>
              <div className={infoRowClass}>
                <span className={labelClass}>Región</span>
                <span className={valueClass}>{lugar ? formatRegion(lugar) : 'No disponible'}</span>
              </div>
              <div className={infoRowClass}>
                <span className={labelClass}>Finalidad</span>
                <span className={valueClass}>{finalidad || 'No disponible'}</span>
              </div>

              <div className={infoRowClass}>
                <span className={labelClass}>Qué recibe el beneficiario</span>
                <span className={valueClass}>{beneficiaryReceivesValue}</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-0 pb-2 mt-auto">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full bg-primary/12 hover:bg-primary/18 text-primary border-primary/25"
            >
              <Link to={grantDetailsHref} onClick={handleViewDetailsClick}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Ver detalles completos
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default GrantCard;
