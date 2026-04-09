import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Maximize2,
  ArrowRightCircle,
  ArrowLeftCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAmount } from '@/lib/utils';
import { formatDeadline, getDeadlineIcon, getDeadlineStatus, getDeadlineStyles } from '@/lib/deadline';

interface MatchCardProps {
  title: string;
  amount: string;
  deadline: string;
  justificacion: string;
  resumen_completo: string;
  beneficiario?: string;
  lugar?: string;
  finalidad?: string;
  queRecibeBeneficiario?: string;
  numero_match?: number;
  grant_id?: string;
}

const MatchCard: React.FC<MatchCardProps> = ({
  title,
  amount,
  deadline,
  beneficiario,
  lugar,
  finalidad,
  queRecibeBeneficiario,
  numero_match,
  grant_id
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const matchDetailsHref = `/subvenciones-compatibles/${grant_id ?? ''}`;

  const matchPercentage = Math.round((numero_match ?? 0) * 100);
  const formattedDeadline = formatDeadline(deadline);
  const deadlineStatus = getDeadlineStatus(deadline);
  const deadlineStyles = getDeadlineStyles(deadlineStatus);

  const formattedAmount = formatAmount(amount);
  const beneficiaryReceivesValue = queRecibeBeneficiario || 'No disponible';

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

  const infoRowClass = "grid grid-cols-[126px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs";
  const labelClass = "font-semibold text-foreground";
  const valueClass = "text-muted-foreground dark:text-gray-300";

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

          <CardHeader className="pb-1 pt-3 pr-14">
            <div className="mb-2">
              <div className="inline-flex text-xs px-2.5 py-1 rounded-full font-semibold bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-sm">
                {matchPercentage}% compatible
              </div>
            </div>

            <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">{title}</h3>

            <div className="flex items-center justify-start gap-2">
              <div className="flex items-center text-xs shrink-0">
                {getDeadlineIcon(deadlineStatus, `mr-1 h-3 w-3 ${deadlineStyles.textColor}`)}
                <span className={`${deadlineStyles.textColor} border-b-2 ${deadlineStyles.borderColor} whitespace-nowrap`}>
                  Plazo: {formattedDeadline}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-1 pt-1.5 flex-1">
            <div className="border-t border-border pt-2 mt-1 text-xs space-y-1">
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
              className="w-full text-xs bg-primary/12 hover:bg-primary/18 text-primary border-primary/25"
            >
              <Link to={matchDetailsHref}>
                <Maximize2 className="h-4 w-4 mr-1" />
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

          <CardHeader className="pb-1 pt-3 pr-14">
            <div className="mb-2">
              <div className="inline-flex text-xs px-2.5 py-1 rounded-full font-semibold bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-sm">
                {matchPercentage}% compatible
              </div>
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">Resumen de la subvención</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{title}</p>
          </CardHeader>

          <CardContent className="pb-1 flex-grow space-y-1.5">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2 space-y-1">
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
              className="w-full text-xs bg-primary/12 hover:bg-primary/18 text-primary border-primary/25"
            >
              <Link to={matchDetailsHref}>
                <Maximize2 className="h-4 w-4 mr-1" />
                Ver detalles completos
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default MatchCard;
