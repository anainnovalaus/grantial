import { AlertTriangle, CalendarDays, CheckCircle, Clock } from 'lucide-react';
import { differenceInCalendarDays, format, isValid, parse, parseISO, startOfDay } from 'date-fns';

export type DeadlineStatus = 'expired' | 'warning' | 'upcoming' | 'coming_soon' | 'unknown';

type DeadlineStyles = {
  textColor: string;
  borderColor: string;
  bgColor: string;
};

const SPANISH_DATE_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WARNING_WINDOW_DAYS = 10;

export const isComingSoonDeadline = (deadline?: string | null): boolean =>
  typeof deadline === 'string' && /^pr[oó]ximamente/i.test(deadline.trim());

export const parseDeadlineDate = (deadline?: string | null): Date | null => {
  if (!deadline) return null;

  const trimmedDeadline = deadline.trim();
  if (!trimmedDeadline || isComingSoonDeadline(trimmedDeadline)) {
    return null;
  }

  let parsedDate: Date;

  if (SPANISH_DATE_PATTERN.test(trimmedDeadline)) {
    parsedDate = parse(trimmedDeadline, 'dd/MM/yyyy', new Date());
  } else if (ISO_DATE_PATTERN.test(trimmedDeadline)) {
    parsedDate = parse(trimmedDeadline, 'yyyy-MM-dd', new Date());
  } else {
    parsedDate = parseISO(trimmedDeadline);

    if (!isValid(parsedDate)) {
      parsedDate = new Date(trimmedDeadline);
    }
  }

  if (!isValid(parsedDate)) {
    return null;
  }

  return startOfDay(parsedDate);
};

export const formatDeadline = (deadline?: string | null): string => {
  if (!deadline) return 'No disponible';

  const trimmedDeadline = deadline.trim();
  if (isComingSoonDeadline(trimmedDeadline)) {
    return trimmedDeadline;
  }

  const parsedDate = parseDeadlineDate(trimmedDeadline);
  if (!parsedDate) {
    return trimmedDeadline || 'No disponible';
  }

  return format(parsedDate, 'dd/MM/yyyy');
};

export const getDeadlineStatus = (deadline?: string | null): DeadlineStatus => {
  if (!deadline) return 'unknown';
  if (isComingSoonDeadline(deadline)) return 'coming_soon';

  const parsedDate = parseDeadlineDate(deadline);
  if (!parsedDate) return 'unknown';

  const dayDifference = differenceInCalendarDays(parsedDate, startOfDay(new Date()));

  if (Math.abs(dayDifference) <= WARNING_WINDOW_DAYS) {
    return 'warning';
  }

  return dayDifference > 0 ? 'upcoming' : 'expired';
};

export const getDeadlineStyles = (status: DeadlineStatus): DeadlineStyles => {
  switch (status) {
    case 'expired':
      return {
        textColor: 'text-red-600 dark:text-red-400',
        borderColor: 'border-red-600 dark:border-red-400',
        bgColor: 'bg-red-50 dark:bg-red-950',
      };
    case 'upcoming':
    case 'coming_soon':
      return {
        textColor: 'text-green-600 dark:text-green-400',
        borderColor: 'border-green-600 dark:border-green-400',
        bgColor: 'bg-green-50 dark:bg-green-950',
      };
    case 'warning':
    case 'unknown':
    default:
      return {
        textColor: 'text-yellow-700 dark:text-yellow-300',
        borderColor: 'border-yellow-500 dark:border-yellow-300',
        bgColor: 'bg-yellow-100 dark:bg-yellow-950',
      };
  }
};

export const getDeadlineIcon = (status: DeadlineStatus, className: string) => {
  switch (status) {
    case 'expired':
      return <AlertTriangle className={className} />;
    case 'upcoming':
      return <CheckCircle className={className} />;
    case 'warning':
      return <Clock className={className} />;
    case 'coming_soon':
    case 'unknown':
    default:
      return <CalendarDays className={className} />;
  }
};
